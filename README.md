# rn-template

React Native(Expo) 모바일 앱과 Rust(Axum) 백엔드를 함께 담은 pnpm + Cargo 모노레포 템플릿입니다. Clone하거나 이 저장소를 GitHub Template으로 사용해 새 프로젝트를 시작하세요.

## 구조

```
apps/
  mobile/    # Expo + expo-router RN 앱 (자기완결적 — 자체 eslint/tsconfig/babel/metro/tailwind 설정 포함)
  api/       # Axum + sqlx + PostgreSQL 백엔드
```

`apps/mobile`은 여러 프로젝트에 재사용하는 것을 전제로 하고, `apps/api`는 지금은 이 프로젝트의 인증(signup/login) 백엔드로만 쓰입니다.

## 포함된 것

**모바일 (`apps/mobile`)**

- Expo(관리형) + expo-router — 파일 기반 라우팅, TypeScript strict
- Zustand, TanStack Query, NativeWind(Tailwind), react-hook-form + zod
- react-native-mmkv + expo-secure-store
- 로그인/회원가입 화면 — `apps/api`의 `/auth/signup`, `/auth/login`을 실제로 호출
- ESLint + Prettier + Jest + React Native Testing Library + Maestro
- `eas.json` 빌드 프로필 골격

**백엔드 (`apps/api`)**

- Axum + tokio, sqlx(+ PostgreSQL, 컴파일타임 쿼리 체크)
- jsonwebtoken(JWT) + argon2(비밀번호 해싱)
- `{ success, data, error }` 형태의 일관된 응답 envelope
- `/health`, `/auth/signup`, `/auth/login`, `/auth/me`

**레포 전역**

- pnpm workspace(`apps/*`) + Cargo workspace(`apps/api`)가 한 레포에 공존
- Husky + lint-staged + commitlint — JS/TS는 eslint+prettier, Rust는 `cargo fmt`
- GitHub Actions CI — `mobile`, `api` job을 분리해서 병행 실행
- `docker-compose.yml` — 로컬 개발용 PostgreSQL만 컨테이너로 띄움 (API 서버 자체는 호스트에서 `cargo run`)

## 빠른 시작

```bash
pnpm install
node scripts/setup.js   # 앱 이름 / 식별자를 새 프로젝트에 맞게 일괄 치환

# 백엔드
cp apps/api/.env.example apps/api/.env   # JWT_SECRET 등을 원하는 값으로 수정
docker compose up -d db
pnpm api:dev                              # apps/api에서 cargo run (최초 실행 시 마이그레이션 자동 적용)

# 모바일 (다른 터미널에서)
pnpm --filter mobile ios                  # 또는 android, web
```

> `react-native-mmkv`, `react-native-nitro-modules` 등 커스텀 네이티브 모듈이 포함되어 있어 **Expo Go로는 실행되지 않습니다.** dev client(`ios`/`android`)로 띄워야 합니다.
>
> Android 에뮬레이터는 `localhost`로 호스트에 접근할 수 없어 `apps/mobile/src/lib/env.ts`가 플랫폼별로 기본 API 주소를 다르게 잡습니다(iOS는 `localhost`, Android는 `10.0.2.2`).

## 인증 흐름

1. `apps/mobile/src/app/_layout.tsx`의 `Stack.Protected`가 `useAuthStore().isAuthenticated`에 따라 `(auth)`/`(app)` 그룹을 가른다.
2. 로그인/회원가입 화면은 `apps/mobile/src/lib/auth-api.ts`로 `apps/api`를 호출하고, 받은 JWT를 `useAuthStore().login()`에 넘긴다.
3. `auth-store.ts`가 토큰을 `expo-secure-store`(iOS Keychain / Android Keystore)에 저장하고 `isAuthenticated`를 갱신한다.
4. 앱 재시작 시 `hydrate()`가 저장된 토큰 유무로 인증 상태를 복원한다.

## 선택 레시피 (기본 미포함)

- **푸시 알림** — `expo-notifications` 설치 후 [Expo 공식 가이드](https://docs.expo.dev/push-notifications/overview/) 참고
- **분석/이벤트 트래킹** — PostHog, Amplitude 등 원하는 SDK를 `apps/mobile/src/lib/analytics.ts` 같은 파일로 감싸서 추가
- **오프라인 동기화/로컬 캐시** — TanStack Query의 캐시 퍼시스턴스(`@tanstack/react-query-persist-client`) + MMKV 조합 검토
- **에러 트래킹** — `sentry-expo` 또는 `@sentry/react-native` 설치 후 [Expo + Sentry 가이드](https://docs.expo.dev/guides/using-sentry/) 참고
- **API 타입 공유** — 엔드포인트가 늘어나면 `utoipa`(+`utoipa-axum`)로 OpenAPI 스펙을 생성하고 `openapi-typescript`/`orval`로 모바일용 TS 클라이언트를 뽑는 걸 검토. 지금은 엔드포인트가 적어 `apps/mobile/src/lib/auth-api.ts`에 zod 스키마를 손으로 맞춰뒀습니다.

## 스크립트

| 명령                                                                | 설명                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm --filter mobile start` / `ios` / `android` / `web`            | 모바일 개발 서버 실행                                    |
| `pnpm --filter mobile typecheck` / `lint` / `test` / `format:check` | 모바일 검증                                              |
| `pnpm api:dev` / `api:build` / `api:test`                           | 백엔드 실행/빌드/테스트 (`apps/api`에서 cargo 실행)      |
| `docker compose up -d db`                                           | 로컬 PostgreSQL만 기동                                   |
| `node scripts/setup.js`                                             | 새 프로젝트로 리네임 (`--self-check`로 로직만 검증 가능) |
