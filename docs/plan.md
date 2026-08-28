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

### Phase 1 — Neon

**DB는 Neon으로 정했다.**

**direct(unpooled) 엔드포인트**를 써야 한다. 풀러(PgBouncer transaction 모드)를 쓰면
`query_as!`가 의존하는 prepared statement가 깨진다. `db.rs:5`가 `max_connections(5)`라
풀러가 애초에 불필요하다.

`apps/api/.env`의 `DATABASE_URL`을 갈고 `pnpm api:dev` — 마이그레이션 4개가 알아서 적용된다.

> `query_as!`는 **컴파일 시점에** `DATABASE_URL`이 가리키는 DB에 붙는다. Neon으로 갈면
> `cargo build`가 Neon을 보게 되고 오프라인에서는 빌드가 막힌다. 빈 Neon DB에서
> NULL 추론 문제(아래 "코드에서 배운 것")가 재현될 수 있다 — `AS "컬럼!"`으로 못 박아뒀으니
> 통과해야 정상이고, 여기서 깨지면 원인은 그것이다.

### Phase 2 — R2

버킷 `little-pieces`를 만들고 **비공개로 둔다** — `storage.rs:60`의 presigned GET으로만 읽는
설계다. Object Read & Write 토큰을 발급해 `apps/api/.env`의 다섯 줄만 갈아끼운다
(`.env.example`에 R2 기준 주석이 이미 있다). `S3_REGION=auto`는 그대로 둔다.

검증은 `./apps/api/scripts/e2e.sh`가 사진 바이트 왕복까지 이미 한다.

### Phase 3 — API 호스팅 ← **유일한 미결**

Neon과 R2가 원격이 되면 **API는 상태 없는 프로세스 하나**다. 어디서 돌든 데이터는 안전하고,
나중에 옮기는 건 바이너리를 옮기는 일이다. 그래서 이 선택은 되돌리기 싸다.

**경로 A — 노트북 + Cloudflare Tunnel (0원)**

`cloudflared`가 `localhost:3000`에 고정 HTTPS 주소를 붙인다. 아웃바운드 연결이라
포트포워딩·고정 IP가 필요 없고 네트워크가 바뀌어도 견딘다.
09:00 알림을 살리려면 맥을 깨운다: `sudo pmset repeat wakeorpoweron MTWRFSU 08:55:00`.

**받아들이는 한계: 맥이 자면 앱이 안 된다.** 이 경로는 Dockerfile도 `.sqlx` 캐시도 필요 없다.

**경로 B — 클라우드 상시 가동 (월 2~3달러 수준, 가입 시 요금 확인)**

경로 A에 없는 작업이 붙는다:

- **`.sqlx` 오프라인 캐시가 지금 없다.** `query_as!`가 컴파일 시점 DB를 요구해서
  **이게 없으면 Docker 빌드가 아예 불가능하다.** `cargo install sqlx-cli --version ^0.9`
  (크레이트 버전과 맞춰야 한다) → `cd apps/api && cargo sqlx prepare` → `.sqlx/`를 커밋.
- **Dockerfile** — `SQLX_OFFLINE=true`, 그리고 **`COPY migrations`를 `cargo build`보다 먼저.**
  `sqlx::migrate!()`가 컴파일 시점에 마이그레이션을 바이너리에 임베드한다.
- **CI에 `cargo sqlx prepare --check`를 추가한다.** 없으면 캐시가 조용히 낡고
  CI가 아니라 **배포가** 깨진다.
- **scale-to-zero / 자동 슬립을 끈다.** 스케줄러가 in-process `sleep`이라
  (`anniversary.rs:110`) 머신이 자면 09:00 알림이 죽는다. 취향이 아니라 제약이다.
- `JWT_SECRET`을 새로 발급한다.

### Phase 4 — 앱을 새 주소로

`apps/mobile/.env`의 `EXPO_PUBLIC_API_URL`을 HTTPS 주소로 바꾸고 릴리스 빌드를 폰에 설치한다.
`ALLOW_CLEARTEXT`는 **주지 않는다** — HTTPS다.

> `EXPO_PUBLIC_API_URL`은 **빌드 시점에 박힌다.** Phase 3에서 주소가 확정된 다음에 밟아야 한다.
> `app.config.js`를 건드렸다면 `expo prebuild`를 따로 돌린다(아래 "환경" 함정).

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

## 배포 후에 볼 것 (실사용해보고 정한다)

- **날짜를 손으로 타이핑한다** (`YYYY-MM-DD`). 네이티브 날짜 피커로 바꾸는 게 첫 후보.
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
  호스팅이 자면 알림이 죽는다. Phase 3의 선택을 제약한다.
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
  `AS "컬럼!"`으로 못 박는다.
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

### Maestro

- **`--device`로 기기를 명시한다.** iOS 시뮬레이터와 Android가 함께 붙어 있으면 엉뚱한 쪽으로 간다.
- **키보드가 떠 있을 때 `scrollUntilVisible`을 쓰지 않는다.** 스와이프가 키보드 위를 지나며
  입력칸에 오타를 남긴다(장소에 `한강g`가 들어갔다).
- **로그아웃 조건은 탭바로 잡는다.** 타임라인 화면만 보면 앱이 지도/설정 탭에 남아 있을 때
  로그인 상태인데도 조건이 안 걸린다.
- **알림 권한 팝업이 플로우를 가린다.** 커플 연결 직후(의도한 시점)에 뜬다.
- **`clearState: true`는 iOS Keychain을 지우지 않는다.** 토큰이 남아 로그인 상태로 시작한다.
- `memory-with-image.yaml`은 **iOS 전용** — 사진 피커가 플랫폼마다 완전히 다르다.
  지도 마커의 접근성 표현도 다르므로 `memory-with-location.yaml`은 마커 라벨 대신
  "빈 상태 안내가 사라졌다"로 확인한다.

---

## 사용자가 챙길 것

**`apps/mobile/credentials/upload.jks` 백업.** gitignore라 레포에 없다.
**잃어버리면 스토어 업데이트를 올릴 수 없다.** 비밀번호가 개발 세션 기록에 남았으므로,
실제 배포 전이라면 재생성하는 편이 낫다 — 아직 아무것도 서명하지 않아 비용이 0이다.
