# 빌드 컨텍스트는 저장소 루트다. 워크스페이스 Cargo.toml/Cargo.lock이 루트에 있고
# apps/api/.sqlx(오프라인 캐시)도 함께 들어가야 하기 때문이다.

FROM rust:1.98-slim-bookworm AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY apps/api ./apps/api
# .sqlx가 있으므로 컴파일 시점에 DB에 붙지 않는다.
# migrations/도 이 시점에 sqlx::migrate!()로 바이너리에 임베드된다 — 별도 마이그레이션 단계가 없다.
ENV SQLX_OFFLINE=true
RUN cargo build --release -p api

FROM debian:bookworm-slim
# rustls-native-certs가 시스템 CA 저장소를 읽는다. 이게 없으면 Neon(sslmode=verify-full)과
# Expo 푸시 HTTPS가 컨테이너 안에서만 깨진다 — 맥에는 자체 저장소가 있어 재현되지 않는다.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN useradd -r -u 10001 app
COPY --from=build /src/target/release/api /usr/local/bin/api
USER app
ENV PORT=3000
EXPOSE 3000
CMD ["api"]
