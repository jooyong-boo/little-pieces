# little-pieces

커플이 날짜·장소·메모로 추억을 함께 쌓는 모바일 앱. Expo(React Native) 앱과 Rust(Axum) 백엔드를 한 레포에 담은 pnpm + Cargo 모노레포입니다.

> 이전 NestJS + Next.js 구현은 원격 `legacy-nest` 브랜치에 보존되어 있습니다.

## 구조

```
apps/
  mobile/    # Expo + expo-router RN 앱
  api/       # Axum + sqlx + PostgreSQL 백엔드
docs/
  plan.md    # 구현 계획과 남은 재검토 항목
```

## 빠른 시작

```bash
pnpm install

# 백엔드
cp apps/api/.env.example apps/api/.env   # JWT_SECRET을 임의의 긴 문자열로 바꾼다
docker compose up -d db                  # 로컬 PostgreSQL (호스트 5433 포트)
pnpm api:dev                             # 최초 실행 시 마이그레이션 자동 적용

# 모바일 (다른 터미널)
pnpm --filter mobile ios                 # 또는 android
```

> `react-native-mmkv` 등 커스텀 네이티브 모듈이 있어 **Expo Go로는 실행되지 않습니다.** dev client(`ios`/`android`)로 띄워야 합니다.
>
> Android 에뮬레이터는 `localhost`로 호스트에 닿지 못해 `apps/mobile/src/lib/env.ts`가 플랫폼별로 기본 API 주소를 다르게 잡습니다(iOS `localhost`, Android `10.0.2.2`).
>
> DB를 5433에 띄우는 이유: 5432는 다른 로컬 프로젝트가 쓰고 있을 수 있습니다. 바꾸려면 `docker-compose.yml`과 `apps/api/.env`를 함께 고치세요.

`sqlx`의 `query_as!`는 **컴파일 시점에** DB가 살아 있어야 합니다. `cargo build` 전에 `docker compose up -d db`가 떠 있어야 하고, `apps/api/.env`의 `DATABASE_URL`이 유효해야 합니다.

## 도메인

- **User** — 이메일/비밀번호(argon2) + 닉네임. 닉네임은 파트너 화면에 그대로 보입니다.
- **Couple** — 이름, 처음 만난 날, 6자리 초대 코드. 최대 2명.
- **CoupleMember** — `user_id`에 UNIQUE가 걸려 있어 **한 유저는 한 커플에만** 속합니다. 애플리케이션 검사가 아니라 DB 제약이라 동시 요청에도 뚫리지 않습니다.
- **Memory** — 제목, 메모, 장소명, 방문일(`DATE`), 위경도(선택). 커플 단위로 공유됩니다.

## API

응답은 전부 `{ success, data, error }` 봉투를 씁니다. 필드는 camelCase.

| 메서드         | 경로             | 인증 | 설명                                        |
| -------------- | ---------------- | ---- | ------------------------------------------- |
| GET            | `/health`        | —    | 헬스체크                                    |
| POST           | `/auth/signup`   | —    | 이메일·비밀번호·닉네임으로 가입, JWT 발급   |
| POST           | `/auth/login`    | —    | 로그인, JWT 발급                            |
| GET            | `/auth/me`       | 토큰 | 내 정보                                     |
| POST           | `/couples`       | 토큰 | 커플 생성 + 초대 코드 발급                  |
| GET            | `/couples/me`    | 토큰 | 내 커플. **없으면 200 + `data: null`**      |
| POST           | `/couples/join`  | 토큰 | 초대 코드로 참여                            |
| PUT            | `/couples/me`    | 커플 | 이름·기념일 수정                            |
| DELETE         | `/couples/me`    | 커플 | 나가기 (마지막 멤버면 커플과 추억까지 삭제) |
| GET            | `/memories`      | 커플 | 타임라인 (방문일 내림차순)                  |
| POST           | `/memories`      | 커플 | 추억 등록                                   |
| GET/PUT/DELETE | `/memories/{id}` | 커플 | 조회·수정·삭제                              |

"인증"은 `AuthUser` 추출기(토큰만), "커플"은 `CoupleMember` 추출기(토큰 + 커플 소속)를 뜻합니다. 커플이 없는 유저도 온보딩을 시작할 수 있어야 하므로 `/couples` 계열 세 개는 토큰만 요구합니다.

## 검증

```bash
# 백엔드
cd apps/api && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test

# 전체 플로우 (서버가 떠 있어야 함) — 가입 4명, 연동, 격리, 나가기까지
./apps/api/scripts/e2e.sh

# 모바일
pnpm --filter mobile typecheck
pnpm --filter mobile lint
pnpm --filter mobile test
pnpm --filter mobile format:check

# 앱 실제 구동 (시뮬레이터에 앱이 설치되어 있고 백엔드가 떠 있어야 함)
# 회원가입 → 커플 생성 → 추억 등록 → 상세 → 설정까지 전부 훑는다
maestro test -e EMAIL="me-$(date +%s)@test.com" apps/mobile/.maestro/signup-to-memory.yaml
```

> **경로에 한글이 있으면 `pod install`만 실패합니다.** `hermes-engine.podspec`에서 `incompatible character encodings: BINARY (ASCII-8BIT) and UTF-8`로 죽습니다. `cargo`, jest, typecheck, lint, `expo export`, E2E 스크립트는 한글 경로에서도 전부 정상입니다 — 막히는 건 CocoaPods 하나뿐이고, 그래서 **iOS 시뮬레이터/기기 빌드만 불가능**합니다. 레포를 ASCII 경로에 두면 해결됩니다.

## 앞으로

`docs/plan.md`의 "2차 이후 로드맵"과 "재검토 항목"을 참고하세요. 요약하면:

1. **지도** — `react-native-maps`. 좌표 컬럼은 이미 있습니다.
2. **이미지** — Cloudflare R2 presigned PUT. 서버는 바이트를 거치지 않습니다.
3. **푸시** — 파트너가 추억을 올릴 때 Expo Push API로 알림.
4. **"n년 전 오늘"** — 3번의 푸시 경로 재사용.

## 스크립트

| 명령                                                                | 설명                    |
| ------------------------------------------------------------------- | ----------------------- |
| `pnpm --filter mobile start` / `ios` / `android`                    | 모바일 개발 서버        |
| `pnpm --filter mobile typecheck` / `lint` / `test` / `format:check` | 모바일 검증             |
| `pnpm api:dev` / `api:build` / `api:test`                           | 백엔드 실행/빌드/테스트 |
| `docker compose up -d db`                                           | 로컬 PostgreSQL 기동    |
| `./apps/api/scripts/e2e.sh`                                         | API 엔드투엔드 검증     |
