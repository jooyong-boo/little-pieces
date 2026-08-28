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
docker compose up -d db minio minio-init # PostgreSQL(5433) + S3 호환 저장소(MinIO, 9000)
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
- **Memory** — 제목, 메모, 장소명, 방문일(`DATE`), 위치(선택), 사진(최대 10장). 커플 단위로 공유됩니다.

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

## 사진 저장소

S3 호환이면 무엇이든 됩니다. 로컬은 `docker compose`의 MinIO, 배포는 Cloudflare R2를 전제로 하고 **코드는 같습니다 — `apps/api/.env`의 다섯 줄만 다릅니다.**

- 서버는 이미지 바이트를 거치지 않습니다. `POST /memories/upload-url`이 서명한 PUT URL을 주고 앱이 저장소로 직접 올립니다. 조회도 서명된 GET URL입니다(버킷은 비공개).
- **객체 키는 서버가 만듭니다** — `couples/{couple_id}/{uuid}.{ext}`. 클라이언트가 키를 정하면 남의 객체를 덮어쓸 수 있습니다.
- 추억을 저장할 때 클라이언트가 보낸 키가 **전부 그 커플 것인지** 형식 파싱으로 검사합니다. 이 검사가 없으면 남의 커플 키를 적어 넣고 서명된 GET으로 사진을 읽을 수 있습니다.
- S3 환경변수 다섯 개 중 하나라도 비면 사진 업로드만 503으로 비활성화되고 나머지 기능은 그대로 돕니다.

## 지도

- **iOS는 API 키가 필요 없습니다.** `react-native-maps` 플러그인은 `iosGoogleMapsApiKey`를 줄 때만 Google Maps Pod을 붙입니다. 키를 주지 않으므로 Apple Maps로 동작합니다(`Podfile.lock`에 GoogleMaps가 없는 것으로 확인 가능).
- **Android는 키가 필요합니다.** `apps/mobile/.env`의 `GOOGLE_MAPS_ANDROID_KEY`를 `app.config.js`가 읽어 매니페스트에 넣습니다. 비어 있으면 Android 지도만 회색으로 뜨고 나머지는 그대로 돕니다.
- 위치는 전체화면 Modal에서 고릅니다. 지도를 폼 안에 인라인으로 두면 ScrollView와 제스처가 싸우기 때문입니다.
- 지도 탭은 좌표가 있는 추억을 마커로, 방문일 오름차순 경로선으로 잇습니다.

## 알림

- **파트너가 추억을 올리면** 상대에게 알림. 요청 스코프라 스케줄러가 없고, 전송 실패가 추억 저장을 막지 않습니다(`tokio::spawn`으로 분리).
- **"n년 전 오늘"** — 매일 오전 9시(KST)에 오늘과 월/일이 같은 과거 추억을 찾아 **커플 두 사람 모두**에게 보냅니다. 함께 만든 추억이라 작성자도 대상입니다.
- 발송 시각 계산이 곧 중복 방지입니다. 보낸 직후 프로세스가 다시 떠도 "오늘 9시"는 이미 지났으므로 다음 차례는 내일이 됩니다.
- Android는 Firebase(FCM) 설정이 필요합니다 — `google-services.json` + Expo에 등록한 FCM V1 서비스 계정 키. iOS는 유료 Apple Developer Program이 필요해 **미검증**입니다.

## 검증

```bash
# 백엔드
cd apps/api && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test

# 전체 플로우 (서버 + db + minio가 떠 있어야 함)
# 가입 4명, 연동, 격리, 나가기, 사진 업로드 바이트 왕복, 타 커플 키 차단까지
./apps/api/scripts/e2e.sh

# 모바일
pnpm --filter mobile typecheck
pnpm --filter mobile lint
pnpm --filter mobile test
pnpm --filter mobile format:check

# 앱 실제 구동 (시뮬레이터에 앱이 설치되어 있고 백엔드가 떠 있어야 함)
maestro test -e EMAIL="me-$(date +%s)@test.com" apps/mobile/.maestro/signup-to-memory.yaml
maestro test -e EMAIL="me-$(date +%s)@test.com" apps/mobile/.maestro/memory-with-image.yaml
maestro test -e EMAIL="me-$(date +%s)@test.com" apps/mobile/.maestro/memory-with-location.yaml
```

> **레포 경로에 한글이 있으면 `pod install`이 실패합니다.** `hermes-engine.podspec`에서 `incompatible character encodings: BINARY (ASCII-8BIT) and UTF-8`로 죽습니다. `cargo`, jest, typecheck, lint, `expo export`, E2E 스크립트는 한글 경로에서도 전부 정상입니다 — 막히는 건 CocoaPods 하나뿐이고, 그래서 **iOS 시뮬레이터/기기 빌드만 불가능**합니다. 레포를 ASCII 경로에 두면 해결됩니다.

## 앞으로

**`docs/plan.md`가 현황과 다음 단계를 담고 있습니다.** 기획한 기능(커플 연동 / 날짜·장소·사진 / 추억맵 / 알림)은 전부 동작하고, 다음 단계는 **배포**입니다 — 지금은 API가 개발 머신에서만 돌아 실제로 둘이 쓸 수 없습니다.

같은 문서에 "다시 겪으면 시간을 버릴 함정들"을 정리해뒀습니다(한글 경로, sqlx NULL 추론, 키보드, Maestro 플랫폼 차이 등).

## 스크립트

| 명령                                                                | 설명                    |
| ------------------------------------------------------------------- | ----------------------- |
| `pnpm --filter mobile start` / `ios` / `android`                    | 모바일 개발 서버        |
| `pnpm --filter mobile typecheck` / `lint` / `test` / `format:check` | 모바일 검증             |
| `pnpm api:dev` / `api:build` / `api:test`                           | 백엔드 실행/빌드/테스트 |
| `docker compose up -d db`                                           | 로컬 PostgreSQL 기동    |
| `./apps/api/scripts/e2e.sh`                                         | API 엔드투엔드 검증     |
