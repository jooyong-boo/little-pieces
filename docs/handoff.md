# 인수인계 — 지금 어디서 돌고, 어떻게 만지나

`plan.md`가 **무엇을 했고 무엇이 남았나**라면, 이 문서는 **살아 있는 것들을 다루는 법**이다.
계정·주소·배포 절차·확인 방법. 새로 맡는 사람이 첫날 필요한 것만 적는다.

> **공개 저장소다.** 계정 ID·엔드포인트 호스트·키는 여기 적지 않는다. 어디서 찾는지만 적는다.

---

## 1. 지금 살아 있는 것

|        | 무엇                               | 어디                                                                                | 요금         |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------- | ------------ |
| API    | Fly.io 앱 `little-pieces`          | `https://little-pieces.fly.dev` · 리전 `sin` · `shared-cpu-1x` 256MB · **머신 1대** | 월 $2 수준   |
| DB     | Neon 프로젝트 `little-pieces`      | 브랜치 `production` · DB `little_pieces` · PG 17 · AWS `ap-southeast-1`             | Free         |
| 사진   | Cloudflare R2 버킷 `little-pieces` | Location `Asia Pacific` · **Public Access Disabled**                                | 무료 한도 내 |
| 저장소 | GitHub `jooyong-boo/little-pieces` | `main` = `little-pieces` 브랜치. 옛 NestJS는 `legacy-nest`                          |              |

셋을 싱가포르로 모은 이유는 **API↔DB 왕복이 요청마다 여러 번**이기 때문이다. 새 호스트를
고를 일이 생기면 이 제약을 먼저 본다.

**머신은 반드시 1대여야 한다.** `anniversary.rs`의 스케줄러가 인스턴스마다 도는 in-process
루프라 2대면 09:00 알림이 두 번 간다. `fly.toml`의 `min_machines_running = 0`이 Fly의
HA 자동 증설을 막고 있다 — 건드리지 말 것. 자동 정지(`auto_stop_machines = "off"`)도 같다.
머신이 자면 알림이 죽는다.

---

## 2. 계정과 비밀

### 사람이 로그인해야 하는 곳

Neon · Cloudflare · Fly.io · Expo/EAS · Apple(Xcode) · Google Cloud(Firebase, Maps 키).

**Google만 개인 계정이 아니다.** `google-services.json`의 프로젝트 `little-pieces-9b1bf`는
개인 Google 계정에서 접근이 안 된다(회사 계정 소유로 보인다). iOS만 쓰는 동안은 영향이
없지만 — Apple Maps를 쓰고 iOS 푸시도 꺼져 있다 — **Android를 쓰기 시작하기 전에 옮겨야
한다.** 절차와 판단할 것은 `plan.md`의 "사용자가 챙길 것"에 있다.

같은 실수가 EAS에서 한 번 있었다(`app.json`의 `owner`). 계정 문제가 의심되면 거기부터 본다.

### 비밀이 있는 곳

| 무엇             | 어디                                            | 저장소에 있나 |
| ---------------- | ----------------------------------------------- | ------------- |
| 프로덕션 env 7개 | Fly 시크릿 (`fly secrets list`로 이름만 보인다) | ❌            |
| 로컬 개발 env    | `apps/api/.env`, `apps/mobile/.env`             | ❌ gitignore  |
| FCM 설정         | `apps/mobile/google-services.json`              | ❌ gitignore  |
| Android 서명 키  | `apps/mobile/credentials/upload.jks`            | ❌ gitignore  |

Fly 시크릿 7개: `DATABASE_URL` `JWT_SECRET` `S3_ENDPOINT` `S3_REGION` `S3_BUCKET`
`S3_ACCESS_KEY_ID` `S3_SECRET_ACCESS_KEY`.

`.env.example` 두 개가 각 값의 형태와 주의사항을 설명한다. **거기부터 읽는다.**

**`JWT_SECRET`은 언제든 갈아도 된다.** `api-client.ts`가 401에 자동 로그아웃하므로
재로그인 한 번으로 끝난다.

**`upload.jks`는 백업이 없으면 끝이다.** 잃어버리면 스토어 업데이트를 영영 못 올린다.
아래 4번 참고.

---

## 3. 배포와 설치

### API

```bash
flyctl deploy --app little-pieces
```

`Dockerfile`이 저장소 루트에 있다(빌드 컨텍스트가 루트여야 워크스페이스 `Cargo.lock`과
`apps/api/.sqlx`가 들어간다). 마이그레이션은 **기동 시 자동 실행**된다 — 별도 단계가 없다.

시크릿을 바꿀 때:

```bash
flyctl secrets set KEY=값 --app little-pieces   # 바로 재배포된다
flyctl secrets list --app little-pieces          # 이름과 다이제스트만 보인다
```

로그:

```bash
flyctl logs --app little-pieces
```

`RUST_LOG=info`가 `fly.toml`의 `[env]`에 있다. **빼면 앱 로그가 한 줄도 안 남는다** —
`EnvFilter::from_default_env()`가 ERROR만 통과시킨다. 09:00 잡이 살아 있다는 증거가
`다음 기념일 알림 대기` 로그뿐이다.

### `.sqlx` 캐시 — DB 쿼리를 고쳤다면

`query_as!`가 컴파일 시점에 DB를 본다. 쿼리를 건드렸으면 캐시를 다시 뽑아야 하고,
**반드시 갓 마이그레이션한 빈 DB에서** 뽑는다. CI와 Neon이 그 조건이라 다른 데서 뽑으면
`cargo sqlx prepare --check`가 CI에서 영영 실패한다.

```bash
docker compose up -d
docker compose exec -T db psql -U postgres -c "create database lp_prepare"
cd apps/api
DB=postgres://postgres:postgres@localhost:5433/lp_prepare
DATABASE_URL=$DB sqlx migrate run
DATABASE_URL=$DB cargo sqlx prepare
git add .sqlx && git commit
```

### iOS 실기기

```bash
cd apps/mobile
npx expo run:ios --device <UDID> --configuration Release
```

UDID는 `xcrun xctrace list devices`. **처음 한 번은 케이블로 페어링**해야 하고, 그 뒤엔
Xcode의 "Connect via network"로 무선도 된다.

> **무료 Apple 계정이라 프로파일이 7일마다 만료된다.** 그때마다 재설치가 필요하다.
> 상대방 폰에 넣으려면 그 폰도 한 번은 이 맥에 물려야 한다.

**`expo prebuild`를 돌렸다면 Xcode에서 팀을 다시 골라야 한다** — `ios/`가 새로 만들어지며
`DEVELOPMENT_TEAM`이 날아간다. 타겟 → Signing & Capabilities → Team.
(`CODE_SIGN_IDENTITY`는 `app.config.js`의 config plugin이 다시 박아준다.)

### Android

```bash
cd apps/mobile
npx expo run:android --variant release
```

APK는 그냥 보내서 설치할 수 있다 — iOS와 달리 만료도 케이블도 없다.

**로컬 API로 실기기 테스트를 하려면** 평문 예외가 필요하다:

```bash
ALLOW_CLEARTEXT=1 npx expo run:android --variant release
```

프로덕션은 HTTPS라 이 값을 **주지 않는다.**

### 네이티브 의존성을 추가했다면

**시뮬레이터와 실기기를 둘 다 다시 빌드해야 한다.** 한쪽만 하면 다른 쪽이
`Cannot find native module ...`로 죽는데, 화면이 열리지 않으니 원인이 엉뚱해 보인다.

---

## 4. 사람만 할 수 있는 일

내(에이전트)가 못 하는 것들이다. 막히면 여기를 본다.

| 무엇                | 왜                                         |
| ------------------- | ------------------------------------------ |
| 계정 가입           | 약관 동의와 비밀번호가 본인 명의다         |
| 결제수단 등록       | R2·Fly 모두 카드가 필요한 시점이 있다      |
| `flyctl auth login` | 브라우저 인증이고 대화형 터미널이 필요하다 |
| Xcode 서명 팀 선택  | Apple ID 세션이 필요하다                   |
| `upload.jks` 재발급 | 비밀번호를 직접 정해야 한다                |

---

## 5. 확인하는 법

```bash
# 백엔드
cargo test -p api                                    # 38개
cargo sqlx prepare --check                           # apps/api에서. 빈 DB 기준
API_URL=https://little-pieces.fly.dev ./apps/api/scripts/e2e.sh

# 모바일
pnpm --filter mobile typecheck
pnpm --filter mobile lint
pnpm --filter mobile test                            # 50개

# 실기기/시뮬레이터 플로우 (--device 로 대상을 명시할 것)
cd apps/mobile
maestro test -e EMAIL="me-$(date +%s)@test.com" --device <id> .maestro/signup-to-memory.yaml
```

`.maestro/` 4개: `signup-to-memory`(다른 셋이 재사용한다) · `memory-with-image`(**iOS 전용**) ·
`memory-with-location` · `memory-from-map`.

**`-e EMAIL=...`은 선택이 아니라 필수다.** 빠뜨리면 이메일 칸에 문자열 `undefined`가 들어가
클라이언트 검증에서 막히는데, 화면만 보면 서버 장애처럼 보인다.

CI(`.github/workflows/ci.yml`)가 push/PR마다 위를 전부 돌린다.

### 시뮬레이터로 검증했다고 말할 수 없는 것

지도와 권한이다. 실기기에서만 드러난 것이 이번에 셋 있었다 —
위치 권한 프롬프트가 안 뜬 것, 버튼이 탭바에 완전히 가려진 것(시뮬레이터에선 아슬아슬하게
보였다), 지도를 한 번도 안 움직이면 중앙 좌표가 `(0, 0)`으로 들어간 것.
Maestro는 항상 팬을 거쳐서 마지막을 못 잡았다.

**통과 조건은 폰에서 Wi-Fi를 끄고 LTE로** 로그인 → 추억 등록 → 사진 → 지도까지 도는 것이다.

---

## 6. 지금 상태와 남은 것

기획한 기능은 **전부 동작하고 원격에 배포돼 있다.** 실사용하며 나온 개선 5건도 끝났다.
자세한 내역과 판단 근거는 `plan.md`에 있다.

**아직 확인 안 된 것 하나:** Android 실기기. 에뮬레이터까지만 봤다. 위 "시뮬레이터로
검증했다고 말할 수 없는 것"이 Android에도 그대로 적용된다 — 특히 위치 권한 다이얼로그와
거부했을 때의 `Alert`은 iOS와 코드 경로가 아예 다르다.

**iOS 푸시는 여전히 미검증이다.** 유료 Apple Developer Program($99/년)이 유일한 관문이다.
가입하면 `app.config.js`의 `IOS_PUSH=1`을 켜야 한다 — **안 켜면 빌드는 초록인데 iOS 푸시만
조용히 죽는다.** TestFlight도 그때 열린다(상대방 폰에 케이블 없이 설치, 프로파일 1년).

그 외 후보는 `plan.md`의 "배포 후에 볼 것"과 "미루는 것"에 있다.

---

## 7. 처음 맡았다면 이 순서로

1. `README.md` — 구조와 도메인
2. **`plan.md`의 "다시 겪으면 시간을 버릴 함정들"** — 여기 적힌 건 전부 실제로 부딪혀 본 것이다.
   먼저 읽으면 하루를 아낀다
3. 이 문서의 3번(배포)과 5번(확인)
4. `apps/api/.env.example`, `apps/mobile/.env.example`
