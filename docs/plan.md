# little-pieces — 현황과 다음 단계

커플이 날짜·장소·사진으로 추억을 쌓는 모바일 앱. Expo(RN) + Rust(Axum) 모노레포.
**이 문서는 새 세션이 이어받는 지점이다.** 끝난 단계의 구현 절차는 git 히스토리에 있다.

## 어디까지 됐나

기획한 기능(커플 연동 / 날짜·장소·사진 / 추억맵 / 알림)은 **전부 동작한다.**

| 기능                              | iOS           | Android        |
| --------------------------------- | ------------- | -------------- |
| 인증·커플 연동·추억 CRUD·타임라인 | ✅            | ✅             |
| 사진 업로드 (presigned PUT)       | ✅            | ✅             |
| 추억맵 (마커 + 방문일 순 경로선)  | ✅ Apple Maps | ✅ Google Maps |
| 파트너 추억 등록 알림             | 코드만        | ✅ 실기기 수신 |
| "n년 전 오늘" (매일 09:00 KST)    | 코드만        | ✅ 실기기 수신 |

검사: Rust 38 / jest 41 / API E2E 42 / Maestro iOS 3개 + Android 2개.
원격 `main`은 최신. 기존 NestJS 코드는 `legacy-nest` 브랜치에 보존.

**iOS 푸시만 미검증** — 유료 Apple Developer Program이 유일한 관문이다. 코드는 Android와
같은 경로를 타므로 계정이 생기면 iPhone 17(페어링됨)으로 확인만 하면 된다.

---

## 다음 단계: 배포

### 왜 이게 먼저인가

**지금 앱은 이 맥에서만 돈다.** API가 `localhost:3000`이고 폰은 같은 Wi-Fi일 때만 붙는다.
맥을 끄면 앱이 죽는다 — 즉 **둘이 실제로 쓸 수 없다.** 다른 어떤 개선보다 앞선다.

배포가 끝나야 실사용이 시작되고, 그래야 "무엇이 진짜 거슬리는지"를 추측이 아니라 경험으로 알 수 있다.

### 이미 준비돼 있다 (코드를 읽고 확인함 — 손대지 마라)

| 위치                                   | 확인된 것                                                               |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `apps/api/src/main.rs:58`              | `0.0.0.0:$PORT` 바인딩 — 어떤 호스팅이든 그대로 붙는다                  |
| `apps/api/src/main.rs:29`              | 시작 시 `sqlx::migrate!()` 자동 실행 — 별도 마이그레이션 단계가 없다    |
| `apps/api/Cargo.toml:17`               | sqlx에 `tls-rustls` — 관리형 Postgres에 바로 붙는다                     |
| `apps/api/src/storage.rs:38`           | `UrlStyle::Path` — R2가 코드 변경 없이 동작한다                         |
| `apps/api/src/config.rs:36`            | S3 5개 중 하나라도 없으면 **사진만** 죽고 서버는 뜬다                   |
| `apps/mobile/app.config.js:7`          | `ALLOW_CLEARTEXT`가 기본 꺼짐 — **"배포 시 끈다"는 이미 끝난 항목이다** |
| `apps/mobile/src/lib/api-client.ts:58` | 401 → 자동 로그아웃 — `JWT_SECRET`을 갈아도 재로그인으로 끝난다         |
| `apps/api/scripts/e2e.sh:8`            | `API_URL`로 대상 서버를 바꾼다 — 배포된 주소에 그대로 겨눌 수 있다      |

### Phase 0 — `.sqlx` 오프라인 캐시 ✅ **완료**

`query_as!`는 **컴파일 시점에** DB에 붙는다. `.sqlx/` 캐시를 커밋해두면 `SQLX_OFFLINE=true`로
네트워크 없이 빌드된다. Phase 3의 Docker 빌드는 **이게 없으면 아예 불가능하고**, Phase 1
이후의 로컬 빌드도 이게 없으면 매번 Neon을 보게 된다. 경로 선택과 무관하게 필요하다.

**반드시 갓 마이그레이션한 빈 DB에서 뽑는다.** 처음엔 "데이터가 있는 쪽이 더 엄격하다"고
적었는데 **측정해보니 틀렸다.** 채워진 개발 DB에서 뽑으면 `cargo sqlx prepare --check`가
CI에서 영영 실패한다 — CI의 postgres 서비스도, Neon도 빈 DB에서 시작하기 때문이다.

갈리는 건 쿼리 하나(`memories` LEFT JOIN `users`)이고, 갈리는 컬럼은 **정확히 매크로로
못 박은 것들뿐**이다:

| 컬럼                                                     | 채워진 DB | 빈 DB    |
| -------------------------------------------------------- | --------- | -------- |
| `id!` `title!` `image_keys!` `visited_at!` `created_at!` | nullable  | not null |
| `author_nickname?`                                       | not null  | nullable |
| 못 박지 않은 나머지 5개                                  | **동일**  | **동일** |

`!`/`?` override가 codegen을 지배하므로 **생성되는 Rust 타입은 어느 쪽이든 같다** —
오프라인 빌드와 `cargo test` 38개로 확인했다. 차이는 JSON 파일뿐인데 `--check`는 파일을
비교한다. 그래서 CI 조건에 맞춘다.

```bash
docker compose up -d
docker compose exec -T db psql -U postgres -c "create database lp_prepare"
cd apps/api
DB=postgres://postgres:postgres@localhost:5433/lp_prepare
DATABASE_URL=$DB sqlx migrate run
DATABASE_URL=$DB cargo sqlx prepare
git add .sqlx && git commit   # cd가 유지된 상태다
```

> **부작용: 데이터가 쌓인 개발 DB로 `--check`를 돌리면 실패한다. 정상이다.**
> 검증은 위처럼 빈 DB를 겨눠서 한다.

`.sqlx`는 `.prettierignore`에 넣었다 — lint-staged의 `*.{json,md,yml,yaml}` 규칙에 걸려
재생성할 때마다 24개가 통째로 재포맷돼 diff를 덮었다.

### Phase 1 — Neon ✅ **완료**

프로젝트 `little-pieces` / 브랜치 `production` / DB `little_pieces` / Postgres 17.
**리전은 AWS Asia Pacific 1 (싱가포르)** — Neon에 도쿄·서울이 없고 아시아는 싱가포르와
시드니뿐이다. 중요한 건 폰↔DB가 아니라 **API↔DB** 지연이므로(요청마다 여러 번 왕복한다)
**Phase 3의 호스트도 싱가포르에 둔다.**

**direct(unpooled) 엔드포인트**를 써야 한다. 풀러(PgBouncer transaction 모드)를 쓰면
`query_as!`가 의존하는 prepared statement가 깨진다. `db.rs:5`가 `max_connections(5)`라
풀러가 애초에 불필요하다.

`apps/api/.env`의 `DATABASE_URL`을 갈고 `pnpm api:dev` — 마이그레이션 4개가 알아서 적용됐다.
검증은 `./apps/api/scripts/e2e.sh` 전체 통과(커플 연동·격리·사진 왕복까지).

**연결 문자열에서 손댄 것 두 가지:**

- Neon 콘솔의 **Connection pooling 토글을 끈다.** 켜져 있으면 호스트에 `-pooler`가 붙는다.
- Neon이 주는 기본값은 `?sslmode=require&channel_binding=require`인데 **sqlx는
  `channel_binding`을 모르고 무시한다**(기동 시 경고를 낸다). 걷어내고 `?sslmode=verify-full`
  하나만 남겼다 — `require`는 TLS만 켜고 서버 인증서를 검증하지 않는다. 자격증명이 공개
  인터넷을 지나므로 검증하는 편이 맞다. sqlx가 이 값을 실제로 파싱하는지는 오타를 넣어
  확인했다(`unknown value "bogus-value" for ssl_mode`로 거부한다).

> Phase 0을 밟았다면 `SQLX_OFFLINE=true`로 빌드가 Neon을 보지 않는다. 건너뛰었다면
> `cargo build`가 Neon에 붙어 오프라인 빌드가 막히고, 빈 Neon DB에서 NULL 추론 문제
> (아래 "코드에서 배운 것")가 재현될 수 있다 — `AS "컬럼!"`으로 못 박아뒀으니 통과해야
> 정상이고, 여기서 깨지면 원인은 그것이다.

### Phase 2 — R2 ✅ **완료**

버킷 `little-pieces` / Location **Asia Pacific**(자동 선택, Neon 싱가포르와 맞다) /
Storage Class **Standard**(무료 한도가 Standard에만 적용된다) / **Public Access: Disabled** —
`storage.rs:60`의 presigned GET으로만 읽는 설계 그대로다.

**토큰은 Account API token으로, 권한을 최소로 좁혔다:** `Object Read & Write` +
버킷을 `little-pieces` 하나로 지정. Admin 권한은 버킷 생성·삭제까지 되므로 앱에 불필요하다.
User token은 계정 상태에 묶여 비활성화될 수 있어 쓰지 않았다(Cloudflare가 프로덕션에
Account token을 권장한다).

`apps/api/.env`의 `S3_*` 다섯 줄을 갈았다. `S3_REGION=auto`는 그대로.
`S3_ENDPOINT`는 `https://<account_id>.r2.cloudflarestorage.com` 형태다.

**검증:** `e2e.sh` 전체 통과(업로드한 바이트와 내려받은 바이트가 동일). MinIO가 로컬에
같이 떠 있어 착각할 수 있으므로 R2 대시보드에서 `couples/` 프리픽스와 Class A 3회 /
Class B 2회가 실제로 잡힌 것까지 확인했다.

> **과금 형태를 알아둘 것.** R2는 "Add R2 subscription"으로 켜는 **자동갱신 사용량 과금**이다.
> 무료 한도는 저장 10GB/월, Class A 100만, Class B 1,000만. 초과 시 저장은 GB당 $0.015/월.
> 사진 한 장이 HEIC 원본 2.7MB이므로 **10GB ≈ 3,700장**이다. "배포 후에 볼 것"의
> 서버측 리사이즈가 결국 여기서 값을 한다.

### Phase 3 — API 호스팅: Fly.io ✅ **완료**

**주소: `https://little-pieces.fly.dev`** — 앱 `little-pieces` / 리전 `sin`(싱가포르, Neon 옆) /
`shared-cpu-1x` 256MB / 머신 **1개**.

노트북 + Cloudflare Tunnel(0원)은 탈락시켰다. 같은 Wi-Fi 제약은 없애지만 "맥이 깨어 있어야
한다"를 그대로 남겨, 이 문서가 배포를 1순위로 놓은 근거를 해결하지 못한다.

Fly.io에 대해 미검증으로 적어뒀던 것들을 공식 문서로 확인했다: 싱가포르 리전 `sin` 존재
(도쿄 `nrt`도 있으나 Neon이 싱가포르다), 자동 정지를 끌 수 있음, `shared-cpu-1x` 256MB
상시 가동 **월 $2.02**. egress는 Asia Pacific $0.04/GB지만 **사진은 폰↔R2 직통(presigned URL)이라
Fly를 지나지 않는다** — JSON만 오가서 사실상 0이다.

#### 이 앱에서 조용히 고장 나는 두 가지 (둘 다 `fly.toml`에서 막았다)

**1. `fly launch`의 기본값이 scale-to-zero다** (`auto_stop_machines = "stop"`,
`min_machines_running = 0`). 그래서 `fly launch`를 쓰지 않고 `fly.toml`을 손으로 썼다.

**2. `min_machines_running = 1`로 두면 Fly가 HA용 머신을 하나 더 띄운다.** 실제로 첫 배포에서
머신이 2개 생겼다. `anniversary.rs`의 스케줄러는 **인스턴스마다** 도는 in-process 루프라
09:00 알림이 **두 번** 간다 — "발송 시각 계산이 곧 중복 방지"는 한 인스턴스의 재시작만 막지
인스턴스 두 개는 못 막는다. 비용도 두 배다. autostop을 껐으므로 이 값은 어차피 무의미해서
`0`으로 두는 것이 맞다.

#### Dockerfile에서 확인하고 넣은 것

- **빌드 컨텍스트는 저장소 루트다.** 워크스페이스 `Cargo.toml`/`Cargo.lock`이 루트에 있고
  `apps/api/.sqlx`도 함께 들어가야 한다.
- **`SQLX_OFFLINE=true`** — Phase 0의 캐시 덕에 컴파일 시점에 Neon을 보지 않는다.
- **런타임에 `ca-certificates`.** `Cargo.lock`에 `rustls-native-certs`가 있어 **시스템 CA 저장소를
  읽는다.** 없으면 Neon(`sslmode=verify-full`)과 Expo 푸시가 **컨테이너 안에서만** 깨진다 —
  맥에는 자체 저장소가 있어 로컬에서는 재현되지 않는 종류다.
- 비루트(uid 10001) 실행. 이미지 172MB.

**`.dockerignore`는 속도가 아니라 비밀 때문에 넣었다.** docker는 `.gitignore`를 보지 않으므로
`apps/api/.env`(Neon 비밀번호 + R2 시크릿)가 그대로 이미지에 구워지고, `main.rs:20`의
`dotenvy::dotenv()`가 그걸 읽어 **Fly 시크릿을 덮어쓴다.** `apps/api/.sqlx`와 `migrations`는
제외하지 않는다 — 둘 다 없으면 빌드가 깨진다.

**`RUST_LOG = "info"`를 `[env]`에 넣었다.** `main.rs:22`가 `EnvFilter::from_default_env()`라
이게 없으면 ERROR만 통과해 **앱 로그가 한 줄도 안 남는다.** 실제로 첫 배포 후 Fly 인프라
로그만 있고 "listening on"조차 없었다. 09:00 잡이 살아 있다는 증거가 이 로그뿐이다.

**시크릿 7개는 `fly secrets import`로 넣었다**(`DATABASE_URL`, `JWT_SECRET`, `S3_*` 5개).
`JWT_SECRET`은 새로 발급했다 — 로컬 `.env` 값을 프로덕션에 재사용하지 않는다.
`api-client.ts:58`이 401에 자동 로그아웃이라 기존 세션은 재로그인 한 번으로 끝난다.

**검증:** `/health` 200, `http://` → `https://` 301 리다이렉트,
`API_URL=https://little-pieces.fly.dev ./apps/api/scripts/e2e.sh` 전체 통과,
로그에서 스케줄러가 **정확히 한 인스턴스**에서 `next=2026-09-05 09:00:00 +09:00`로 대기 중임을 확인.

### Phase 4 — 앱을 새 주소로 — iOS ✅ / Android 남음

`apps/mobile/.env`의 `EXPO_PUBLIC_API_URL`을 **`https://little-pieces.fly.dev`**로 바꿨다.
`ALLOW_CLEARTEXT`는 주지 않는다 — HTTPS다.

**`expo prebuild`는 다시 돌릴 필요가 없다.** `EXPO_PUBLIC_API_URL`은 JS에서만 쓰이고
(`src/lib/env.ts` → `api-client.ts`) `app.config.js`를 타지 않는다. prebuild가 필요한 건
`app.config.js`를 건드렸을 때다(아래 "환경" 함정).

**한글 경로 `pod install` 함정은 현재 작업 경로에 해당하지 않는다** — 전부 ASCII다.

#### iOS 시뮬레이터 검증 (완료)

Maestro `signup-to-memory` 전체 통과 — 회원가입 → 커플 생성 → 추억 등록 → 수정 → 설정.
로컬 API가 꺼진 상태(`:3000` 아무것도 안 들음, docker 내려감)에서 통과했고,
Neon에 실제로 남은 것까지 확인했다:

```
ios-1788516629@test.com | 2026-09-04 10:10:55+00
첫 산책 | 한강          | 2026-09-04 10:11:11+00
```

> Maestro 플로우는 `-e EMAIL=...`이 **필수다.** 안 주면 이메일 칸에 문자열 `undefined`가
> 들어가 클라이언트 검증에서 막히고, 서버 문제처럼 보인다. 플로우 첫머리 주석에 실행법이 있다.

#### iOS 실기기 서명 (사람이 해야 하는 부분)

**Xcode에 Apple ID를 로그인하는 것만으로는 인증서가 생기지 않는다.** 프로젝트에서
타겟 → Signing & Capabilities → Automatically manage signing → Team을 고르는 순간 생성된다.
그 전에는 `expo run:ios --device`가 `No code signing certificates are available to use.`로 죽는다.

**엔타이틀먼트가 비어 있어(`aps-environment` 없음) 무료 Apple ID로도 설치된다.**
유료 Developer Program은 푸시에만 필요하다. 무료 프로파일은 **7일마다 재설치**해야 한다
(이번 프로파일 만료: 2026-09-11).

#### 실기기 설치가 죽던 진짜 이유 — 서명이 아니라 **프레임워크 서명**

서명·프로파일이 다 맞는데도 설치가 `ApplicationVerificationFailed`로 죽었다.
`xcrun devicectl device install app`으로 직접 설치하니 진짜 메시지가 나왔다:

```
Failed to verify code signature of .../Frameworks/hermesvm.framework
0xe800801c (No code signature found.)
```

**임베드된 프레임워크 14개가 전부 미서명이었다.** 앱 본체만 서명돼 있었다.

원인은 한 줄이다:

```
CODE_SIGN_IDENTITY = "iPhone Developer"     ← Expo 템플릿 기본값(레거시 이름)
실제 인증서         = "Apple Development: ..."  ← 현재 이름
```

CocoaPods의 `Pods-LittlePieces-frameworks.sh`가 `code_sign_if_enabled()`에서
`-n "${EXPANDED_CODE_SIGN_IDENTITY:-}"`를 본다. 이름이 안 맞으면 이 변수가 **빈 값**이
되어 서명을 **조용히 건너뛴다**. 빌드는 `0 error(s)`로 성공하고 앱 본체는 자동 서명이
따로 처리하므로, **빌드 로그만 봐서는 아무 문제가 없어 보인다.**

확인 방법: 빌드 로그에 `Code Signing ... with Identity`가 몇 건인지 센다.
정상이면 프레임워크 수만큼, 고장이면 **0건**이다.

**고친 곳은 `app.config.js`다.** `ios/`는 gitignore(CNG)라 `project.pbxproj`를 직접
고쳐도 `expo prebuild`가 되돌린다. `withXcodeProject`로 `CODE_SIGN_IDENTITY[sdk=iphoneos*]`를
`"Apple Development"`로 박는 config plugin을 넣었다. 적용 후 재빌드하니 수동 재서명 없이
프레임워크 14개가 서명되고 폰에 설치됐다.

### Phase 5 — `upload.jks` 재발급

비밀번호가 개발 세션 기록에 남았다. **아직 아무것도 서명하지 않아 지금은 비용이 0이다** —
스토어에 한 번 올리고 나면 서명 키는 영영 못 바꾼다. 재발급한 뒤 **레포 밖에 백업한다**
(gitignore라 레포에 없고, 잃어버리면 스토어 업데이트를 올릴 수 없다).

### 앱 배포를 재개할 때 (지금은 보류)

EAS 배포는 미뤘다. 재개하는 세션이 밟을 지뢰들이다 —
**전부 빌드는 초록으로 성공하고 폰에서 기능만 조용히 죽는다.**

- **`google-services.json`이 gitignore다.** EAS는 git으로 소스를 올려서 클라우드 prebuild가
  파일을 못 본다 → `app.config.js:14`의 `hasFirebase`가 `false` → FCM이 매니페스트에 안 들어감
  → **Android 푸시 토큰 발급 자체가 실패한다.** 대시보드 설정이 아니라 **`app.config.js` 코드
  수정**이 필요하다 — EAS file-type 시크릿 경로를 env로 읽고 지금의 로컬 파일 검사를 fallback으로.
- **Maps Android 키의 SHA-1이 debug keystore 것이다.** EAS 서명 키로 빌드하면 SHA-1이 달라
  Android 지도가 회색으로 뜬다. 순서를 지켜야 두 번 등록하지 않는다:
  **keystore 재발급 → `eas credentials`로 SHA-1 확인 → Google Cloud에 등록.**
- **`eas.json`의 `production`이 `{}`다.** 기본값이 AAB + store distribution이라
  **사이드로드가 안 된다.** 둘이 쓸 거면 `distribution: "internal"` + `android.buildType: "apk"`.
  최신 EAS CLI는 `cli.appVersionSource`도 요구한다.
- **env가 gitignore된 `.env`에만 있다.** `EXPO_PUBLIC_API_URL`은 비밀이 아니니 `eas.json`의
  프로필별 `env`에 넣고(버전 관리되는 편이 낫다), `GOOGLE_MAPS_ANDROID_KEY`는 EAS 시크릿으로.

### 검증

```bash
curl https://<주소>/health
API_URL=https://<주소> ./apps/api/scripts/e2e.sh   # 연동·격리·사진 왕복·타 커플 키 차단까지
```

폰에서는 **맥의 Wi-Fi에서 떼고**(LTE로) 로그인 → 추억 등록 → 사진 → 지도까지.
이게 이번 작업의 통과 조건이다.

---

## 실사용하며 고친 것

배포가 끝나고 실제로 써보며 나온 요구다. 4건 중 진행 상황:

|                                                   | 상태 |
| ------------------------------------------------- | ---- |
| 목록에 사진이 한 장만 보임 → 장수 배지            | ✅   |
| 날짜를 손으로 `YYYY-MM-DD` 타이핑 → 네이티브 피커 | ✅   |
| 지도를 길게 눌러 그 자리에 등록                   | 예정 |
| 지도에서 현재 위치로 이동                         | 예정 |

**`@expo/ui`가 이미 설치돼 있었다** — iOS Pod(`Podfile.lock`의 `ExpoUI`)까지 빌드에 들어가
있는데 `src/`에서 한 번도 안 쓰이고 있었다. 날짜 피커에 새 의존성이 필요 없었다.

---

## 배포 후에 볼 것 (실사용해보고 정한다)

- **역지오코딩** — 핀을 찍으면 `placeName`이 자동으로 채워지면 좋다. Geocoding API 요금이 붙는다.
- **서버측 이미지 리사이즈** — `quality: 0.7`을 줘도 HEIC 원본이 2.7MB로 올라가는 것을 확인했다.
  사진이 쌓이면 이게 비용의 대부분이 된다.

---

## 미루는 것 (지금 손대면 낭비)

둘이 쓰는 규모에서는 영향이 없다. 공개 서비스로 갈 때 다시 본다.

- 고아 객체 정리 — 작성 취소/사진 제거 시 R2 객체가 남는다. 개발 중 이미 몇 개 쌓였다.
- `POST /memories/upload-url` 레이트 리밋 — 인증 유저가 반복 호출해 객체를 무한정 넣을 수 있다.
- 마커 클러스터링, 이미지 순서 재배치, 업로드 진행률 합산 UI.
- `+` 버튼 연타 — 두 호출이 같은 남은 칸 수를 보고 10장을 넘길 수 있다. `addImage`가 잘라내므로
  데이터는 안 깨지고 초과분만 버려진다. 업로드 중 버튼 비활성화면 끝난다.
- 폼이 열린 채 백그라운드 refetch — 방금 올린 사진이 로컬 `file://`에 머문다.
  저장 후 바로 `router.back()`이라 닿기 어렵다. 폼을 `query.data.id`로 keying하면 해결.
- 스케줄러: 서버가 09:00에 꺼져 있으면 그날은 건너뛴다. 2월 29일 추억은 평년에 울리지 않는다.
  **다만 앞의 절반은 더 이상 미룰 수 있는 항목이 아니다** — in-process `sleep`이라
  호스팅이 자면 알림이 죽는다. Phase 3에서 자동 슬립 없는 호스트를 고르는 것으로 해결한다.
- Android 탭 아이콘 — iOS SF Symbol만 줘서 Android는 라벨만 나온다.

---

## 다시 겪으면 시간을 버릴 함정들

실제로 부딪혀서 알아낸 것들이다. **추측이 아니라 관찰된 사실만 적는다.**

### 환경

- **경로에 한글이 있으면 `pod install`이 실패한다.** `hermes-engine.podspec`에서
  인코딩 충돌(BINARY vs UTF-8). `LANG`/`RUBYOPT`로는 안 풀린다. cargo/jest/lint/`expo export`는
  한글 경로에서도 정상 — **iOS 네이티브 빌드만** 막힌다.
- **Android 개발 빌드는 저사양 기기에서 시작에 14초**(번들 4.3초 + 렌더 8.4초), **릴리스는 0.9초.**
  실기기 확인은 릴리스 빌드로 하는 편이 빠르고 안정적이다.
- **Android 릴리스는 평문 HTTP를 차단한다.** `ALLOW_CLEARTEXT=1`일 때만 켜지는 opt-in으로 뒀다.
- **실기기는 `localhost`로 맥에 못 닿는다.** `10.0.2.2`는 에뮬레이터 전용. 맥의 LAN IP를 쓴다.
- **`app.config.js`를 바꾸면 `expo prebuild`를 따로 돌려야 한다.** `android/`가 이미 있으면
  `expo run:android`가 config를 다시 반영하지 않아 매니페스트에 조용히 안 들어간다.
- **`expo prebuild`는 `DEVELOPMENT_TEAM`을 지운다.** `ios/`를 다시 만들기 때문이다.
  `CODE_SIGN_IDENTITY`는 config plugin이 다시 박아주지만 팀은 아니다 — 매번 Xcode에서
  타겟 → Signing & Capabilities → Team을 다시 골라야 실기기 빌드가 된다.
  (팀 ID를 plugin에 하드코딩하면 다른 사람이 이 저장소를 빌드할 때 깨지므로 안 넣는다.)
- **pbxproj에서 대괄호가 든 키는 따옴표로 감싸는 것이 문법이다.** `updateBuildProperty`에
  `CODE_SIGN_IDENTITY[sdk=iphoneos*]`를 따옴표 없이 넘기면 두 가지가 한꺼번에 터진다:
  기존 키를 교체하지 못해 **원본이 그대로 남고**, 생성된 파일이 파싱 불가능해져
  **다음 `expo prebuild`가 통째로 죽는다**(`Expected "/*", "=", or [A-Za-z0-9_.] but "[" found`).
  즉시 드러나지 않는다 — `ios/`를 손으로 고쳐둔 상태에서는 빌드가 멀쩡히 돌기 때문에,
  config plugin은 **"mod이 등록된다"가 아니라 "prebuild가 통과한다"로 확인해야 한다.**
- Expo/EAS 로그인은 **액세스 토큰**(`~/.expo-token`, `EXPO_TOKEN`)으로 한다. 비밀번호가 필요 없다.

### 계정·자격증명

- **`app.json`의 `owner`가 EAS 프로젝트 소유 계정을 결정한다.** 회사 계정으로 박혀 있어
  `eas init`이 계속 그쪽을 보고 개인 계정 토큰으로는 권한 오류가 났다. 오늘 헤맨 주된 이유.
- **Expo 대시보드의 "Google Service Account Key" 슬롯은 두 개다.** 마법사 4단계는
  **Play 스토어 업로드용**이고, FCM 푸시용은 마법사 완료 후 나타나는 별도 슬롯이다.
- **Android 푸시에는 Firebase(FCM) 설정이 필요하다.** 무료지만 `google-services.json` +
  Expo에 등록한 FCM V1 서비스 계정 키가 있어야 토큰 발급 자체가 된다.
- **`google-services.json`과 `credentials/`는 gitignore.** 전자는 APK에 그대로 들어가 비밀은
  아니지만 공개 레포에서 긁히기 쉽다. 후자는 진짜 비밀이다.
- **Maps Android 키의 SHA-1은 공용 debug 키스토어 것이다**(생성일 2014-01-01, RN/Expo 템플릿 배포).
  제한이 실질적으로 막는 건 패키지명 하나뿐. 실제 보호는 배포용 키스토어 SHA-1을 등록할 때 생긴다.

### 코드에서 배운 것

- **`sqlx`의 NULL 추론은 쿼리 플랜에 의존한다.** 테이블에 데이터가 쌓이자 LEFT JOIN 왼쪽
  컬럼까지 nullable로 보기 시작해 빌드가 깨졌다. **빈 DB에서만 컴파일되던 코드였다.**
  `AS "컬럼!"`으로 못 박는다. **`.sqlx` 캐시에도 그대로 새겨진다** — 같은 쿼리를 빈 DB와
  채워진 DB에서 뽑으면 JSON의 `nullable` 배열이 갈린다. override가 codegen을 지배해
  타입은 같지만 `prepare --check`는 파일을 비교하므로 실패한다. Phase 0 참고.
- **`EXTRACT`는 NUMERIC을 돌려준다.** int로 캐스팅해야 파라미터 타입이 맞는다.
- **`Link asChild`가 넣는 `onPress`를 `View`는 무시한다.** `Pressable`이어야 한다.
- **`Pressable`은 자식 텍스트를 접근성 요소 하나로 합친다.** `accessibilityLabel`을 명시하지 않으면
  이모지까지 읽힌다.
- **`fitToCoordinates`는 마운트 직후 호출에서 효과가 없었다**(이유는 미확인). 첫 화면은
  `regionForCoordinates()`로 계산해 `initialRegion`에 넣어 시점에 의존하지 않게 했다.
- **중앙 고정 핀은 이모지로 만들지 않는다.** 글리프 안에서 뾰족한 끝 위치가 폰트마다 달라
  보이는 지점과 저장되는 좌표가 어긋난다. 원은 중심이 곧 지점이다.
- **NativeWind는 `global.css`를 import해야 동작한다.** css-interop의 변환이 `resolveRequest`에서만
  걸려서, import가 없으면 스타일이 하나도 등록되지 않는다(번들은 성공한다).
- **키보드가 제출 버튼을 덮는다.** iOS 시뮬레이터는 하드웨어 키보드라 안 드러난다.
  `keyboardShouldPersistTaps="handled"`가 없으면 모든 폼에서 첫 탭이 버려진다.
- **`@expo/ui` 날짜 피커의 타임존 기준이 플랫폼마다 반대다.** Android(Material3
  `DatePickerState`)는 UTC 밀리초로 읽고 쓰지만, iOS(SwiftUI `DatePicker`)는 기기 타임존이다.
  한쪽 기준으로 통일해 넘기면 UTC 오프셋만큼 하루가 어긋난다 — KST에서는 하루 전날이 뜬다.
  정오로 맞추는 우회도 안 통한다(Android는 읽을 때 정오가 아니라 UTC 자정을 돌려준다).
  `timeline.ts`의 `fromIsoDate`/`toIsoDate`가 `utc` 인자로 이걸 흡수하고,
  `Platform.OS` 판단은 `date-field.tsx` 한 줄에만 있다.
- **iOS의 `DatePicker`는 항상 인라인이다**(`display` prop을 받지만 무시한다). 폼에 상시
  마운트하면 달력이 통째로 펼쳐져 제출 버튼이 화면 밖으로 밀린다. Android는 반대로
  `presentation` 기본값이 `dialog`라 **마운트하는 순간 다이얼로그가 열린다.** 그래서 양쪽 다
  상시 마운트가 불가능하고, 트리거를 눌렀을 때만 마운트하는 방식이 유일한 공통 해법이다.

### Maestro

- **`--device`로 기기를 명시한다.** iOS 시뮬레이터와 Android가 함께 붙어 있으면 엉뚱한 쪽으로 간다.
- **키보드가 떠 있을 때 `scrollUntilVisible`을 쓰지 않는다.** 스와이프가 키보드 위를 지나며
  입력칸에 오타를 남긴다(장소에 `한강g`가 들어갔다).
- **로그아웃 조건은 탭바로 잡는다.** 타임라인 화면만 보면 앱이 지도/설정 탭에 남아 있을 때
  로그인 상태인데도 조건이 안 걸린다.
- **알림 권한 팝업이 플로우를 가린다.** 커플 연결 직후(의도한 시점)에 뜬다.
- **`clearState: true`는 iOS Keychain을 지우지 않는다.** 토큰이 남아 로그인 상태로 시작한다.
- **`-e EMAIL=...`은 선택이 아니라 필수다.** 빠뜨리면 이메일 칸에 문자열 `undefined`가 들어가
  클라이언트 검증에서 막히는데, 화면만 보면 서버 장애처럼 보인다. 실행법은 플로우 첫머리 주석에 있다.
- **Android는 텍스트 입력이 눈에 띄게 느리다.** `inputText`가 한 글자씩 들어가서, iOS에서
  몇 초 걸리던 플로우가 분 단위가 된다. 타임아웃을 iOS 기준으로 잡으면 안 된다.
- `memory-with-image.yaml`은 **iOS 전용** — 사진 피커가 플랫폼마다 완전히 다르다.
  지도 마커의 접근성 표현도 다르므로 `memory-with-location.yaml`은 마커 라벨 대신
  "빈 상태 안내가 사라졌다"로 확인한다.

---

## 사용자가 챙길 것

**`apps/mobile/credentials/upload.jks`** — 재발급과 백업. Phase 5로 올렸다.

**클라우드 호스팅 결제 수단과 Neon·R2·Fly.io 계정.** 코드로 대신할 수 없는 유일한 부분이다.
