# little-pieces 재구축 — rn-template(Expo + Rust Axum) 기반

## Context

`jooyong-boo/little-pieces`는 커플 추억 공유 서비스로 NestJS + Next.js + Prisma 모노레포에서 시작했지만, 도메인 구현이 `Couple 생성` / `내 커플 조회` / `Memory 생성·목록`까지만 있고 **커플 연동(초대) 경로 자체가 없어** 실제로 쓸 수 없는 상태에서 멈춰 있다(마지막 push 2026-03-09).

그 사이 만든 `jooyong-boo/rn-template`(Expo 57 + expo-router + Axum 0.8 + sqlx)이 인증·CI·린트·테스트까지 갖춰져 있으므로, **웹을 버리고 모바일 앱으로 방향을 바꿔** 이 템플릿 위에 도메인을 다시 얹는다.

목표: 인증 → 커플 연동 → 추억 등록 → 타임라인이 실제로 도는 MVP.

### 확정된 결정

| 항목     | 결정                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 레포     | 기존 `jooyong-boo/little-pieces` 재사용. 기존 main은 `legacy-nest` 브랜치로 보존 후 교체 |
| 플랫폼   | 모바일 단독. 기존 `apps/web`(Next.js/FSD) 폐기                                           |
| MVP 범위 | 인증 + 커플 연동 + 추억 CRUD + 타임라인                                                  |
| 지도     | `react-native-maps` — **2차**. MVP는 좌표만 저장                                         |
| 이미지   | Cloudflare R2 presigned PUT — **2차**. MVP는 스키마 컬럼만                               |
| DB       | 로컬 `docker compose up -d db`. 배포처는 MVP 이후 결정                                   |

### 명시적으로 미루는 것 (누락 아님)

예약 발송 편지, 기념일 D-Day **푸시**(둘 다 백그라운드 스케줄러 필요 — MVP에 스케줄러를 넣지 않는 것이 이 선의 이유), 지도 클러스터링, 오프라인 동기화, 홈 위젯, 영상 업로드, AI 앨범 생성.

---

## 1단계 — 레포 세팅

1. `~/projects/rn-template`의 파일을 이 워크트리(`/Users/boo/orca/workspaces/개인플젝/little-pieces`)로 복사. **제외**: `.git`, `node_modules`, `target`, `apps/mobile/android`, `apps/mobile/ios`, `apps/mobile/.expo`.
   - `android/`, `ios/`는 `expo prebuild`로 재생성되는 산출물이고 rn-template에서도 `.gitignore` 대상이다. 복사하면 bundle id가 옛 값으로 굳는다.
2. `node scripts/setup.js` — 앱 이름 `little-pieces`, slug `little-pieces`, scheme `littlepieces`, bundle id `com.littlepieces.app`로 일괄 치환. (`app.json`, 루트 `package.json`, Maestro flow만 건드림)
3. `pnpm install`
4. `cp apps/api/.env.example apps/api/.env` — `query_as!`는 **컴파일 시점**에 `DATABASE_URL`이 필요하므로 이게 없으면 첫 `cargo build`부터 실패한다. `JWT_SECRET`도 여기서 채운다.
5. remote 연결 + 기존 코드 보존:
   ```bash
   git remote add origin https://github.com/jooyong-boo/little-pieces.git
   # 원격 main SHA를 legacy-nest 브랜치로 백업 (git-workflow.md: 원격 조작은 gh 우선)
   gh api repos/jooyong-boo/little-pieces/branches/main --jq .commit.sha
   gh api -X POST repos/jooyong-boo/little-pieces/git/refs \
     -f ref=refs/heads/legacy-nest -f sha=<위 SHA>
   ```
   > `legacy-nest` 생성을 **확인한 뒤에만** main 교체를 진행한다.
   >
   > 로컬 히스토리는 원격 main과 무관한 빈 커밋 1개라 main 교체는 기존 원격 브랜치에 대한 force push다. `git-workflow.md` 기준으로 하네스 가드레일이 막는 케이스이므로, `legacy-nest` 확인 후 **사용자가 직접** `! git push origin little-pieces:main --force`를 실행하도록 요청한다.

---

## 2단계 — 백엔드 (`apps/api`)

### 2-1. 마이그레이션

`migrations/<ts>_add_nickname.up.sql` — 커플 앱은 "누가 올렸는지"가 보여야 하므로 닉네임이 필수다.

```sql
ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT '';
```

`migrations/<ts>_create_couples_memories.up.sql`

```sql
CREATE TABLE couples (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    anniversary_date DATE,
    invite_code TEXT NOT NULL UNIQUE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE couple_members (
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    -- 한 유저는 한 커플에만. 기존 NestJS는 findFirst 체크로 했는데 동시 요청에 뚫린다.
    -- DB 제약으로 옮기면 모든 경로가 한 번에 막힌다.
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (couple_id, user_id)
);

CREATE TABLE memories (
    id UUID PRIMARY KEY,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    place_name TEXT,
    latitude DOUBLE PRECISION,   -- 위치 없는 추억도 허용하므로 nullable (2차 지도에서 사용)
    longitude DOUBLE PRECISION,
    visited_at DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX memories_couple_visited_idx ON memories (couple_id, visited_at DESC);
```

대응하는 `.down.sql`도 함께 작성(rn-template 규칙: `migrations/*.up.sql` / `*.down.sql` 쌍).

> ID는 UUID. 기존 Prisma 스키마는 cuid 문자열이었지만 rn-template의 `users.id`가 `Uuid`이므로 거기에 맞춘다.

### 2-2. 인증 추출기 — 기존 코드의 실제 문제부터 고친다

`apps/api/src/auth/handlers.rs:74-90`의 `me`는 Authorization 헤더를 **핸들러 안에서 직접 파싱**한다. 앞으로 추가할 커플·추억 엔드포인트 8개가 전부 같은 코드를 필요로 하므로, 복사하지 말고 추출기로 뽑는다.

**신규 `apps/api/src/auth/extractor.rs`**

- `struct AuthUser { user_id: Uuid }` — `impl FromRequestParts<AppState>`. 헤더 파싱 + `jwt::verify`. 실패 시 `AppError::InvalidCredentials`.
- `struct CoupleMember { user_id: Uuid, couple_id: Uuid }` — `AuthUser`를 거친 뒤 `couple_members`를 조회. 커플 미소속이면 `AppError::NoCouple`(신규 variant → 403).
  - memories 핸들러 5개가 전부 `couple_id`를 필요로 하므로, 헬퍼 함수보다 추출기가 이긴다.
- `me` 핸들러를 `AuthUser`를 쓰도록 리팩터 — 새 경로만 고치고 기존 파싱을 남겨두면 같은 로직이 두 벌이 된다.

**어느 엔드포인트가 어느 추출기를 쓰는지가 중요하다.** 커플이 아직 없는 유저도 `POST /couples`, `POST /couples/join`, `GET /couples/me`를 호출할 수 있어야 하므로 이 셋은 `AuthUser`다. `CoupleMember`를 쓰면 신규 유저가 온보딩을 시작할 방법이 없어진다.

| 추출기         | 엔드포인트                                                               |
| -------------- | ------------------------------------------------------------------------ |
| `AuthUser`     | `GET /auth/me`, `POST /couples`, `POST /couples/join`, `GET /couples/me` |
| `CoupleMember` | `PATCH /couples/me`, `/memories` 전부                                    |

`apps/api/src/error.rs`에 variant 추가: `NoCouple`(403), `AlreadyInCouple`(409), `InviteNotFound`(404), `CoupleFull`(409), `NotFound`(404).

### 2-3. 도메인 모듈

`apps/api/src/users.rs`와 같은 "얇은 함수 + `sqlx::query_as!`" 스타일을 그대로 따른다(레이어 추가 금지).

**`apps/api/src/couples/`** — `mod.rs`, `handlers.rs`, `repo.rs`

| 엔드포인트           | 동작                                                                              |
| -------------------- | --------------------------------------------------------------------------------- |
| `POST /couples`      | 커플 생성 + 생성자를 owner로 가입 + `invite_code` 발급. 한 트랜잭션.              |
| `GET /couples/me`    | 내 커플 + 멤버(닉네임 포함) + `invite_code`. **커플이 없으면 200 + `data: null`** |
| `POST /couples/join` | `{ invite_code }` → 해당 커플에 member로 가입                                     |
| `PATCH /couples/me`  | `name`, `anniversary_date` 수정                                                   |

- **`GET /couples/me`가 커플 없음을 에러로 내면 안 된다.** 신규 유저의 정상 상태가 매번 HTTP 에러가 되고, TanStack Query가 기본 3회 재시도 + 백오프를 돌려 온보딩이 필요한 유저에게만 콜드 스타트가 몇 초씩 늘어난다. 토큰 만료(401)와도 구분이 안 된다. `data: null`로 내려서 앱이 `data === null → 온보딩`으로 분기하게 한다.
- 초대 코드: 대문자+숫자 6자리. `couple_members.user_id`/`couples.invite_code`의 UNIQUE 위반을 `sqlx::Error::Database(e) if e.is_unique_violation()`로 잡아 각각 `AlreadyInCouple` / 코드 재생성으로 매핑. 재생성은 3회까지.
- join 시 정원(2명) 확인. 카운트 후 INSERT는 같은 코드를 동시에 입력하면 둘 다 1을 보는 TOCTOU라, 트랜잭션 안에서 `SELECT id FROM couples WHERE id = $1 FOR UPDATE`로 잠근 뒤 센다. 초과면 `CoupleFull`.

**`apps/api/src/memories/`** — `mod.rs`, `handlers.rs`, `repo.rs`

| 엔드포인트             | 동작                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `POST /memories`       | `CoupleMember` 추출기가 소속을 보장. `author_user_id`는 토큰에서 |
| `GET /memories`        | 내 커플 것만, `ORDER BY visited_at DESC, created_at DESC`        |
| `GET /memories/:id`    | 내 커플 것이 아니면 `NotFound` (존재 여부를 흘리지 않음)         |
| `PATCH /memories/:id`  | 위와 동일한 소유권 확인                                          |
| `DELETE /memories/:id` | 위와 동일                                                        |

- 소유권 체크는 `WHERE id = $1 AND couple_id = $2`로 쿼리 자체에 넣는다. 별도 조회 후 비교하면 TOCTOU가 생기고 코드도 늘어난다.
- 검증: `title` 1~120자, `description` ≤ 500자, 위경도가 오면 범위 체크. `auth/handlers.rs`의 `validate_credentials`와 같은 순수 함수 + 단위 테스트 스타일로.

**`apps/api/src/routes.rs`** — 위 9개 라우트 등록. 기존 구조 유지.

**`signup` 확장**: `SignupRequest`에 `nickname` 추가(1~20자 검증), `users::create` 시그니처에 반영.

### 2-4. sqlx 컴파일타임 매크로 주의

`query_as!`는 빌드 시 살아있는 DB가 필요하다. 로컬은 `docker compose up -d db` 후 `.env`의 `DATABASE_URL`, CI는 `.github/workflows/ci.yml`의 `api` job이 이미 Postgres 서비스 + `sqlx migrate run`을 돌리므로 **추가 설정 불필요**. (`.sqlx` 오프라인 캐시는 지금 필요 없음)

---

## 3단계 — 모바일 (`apps/mobile`)

### 3-1. 공통 API 클라이언트 — 기존 파일을 일반화

`src/lib/auth-api.ts`에 이미 `{ success, data, error }` envelope 파싱 + zod 검증 로직이 있다. 이걸 **새 파일로 복사하지 말고** 뽑아낸다.

**신규 `src/lib/api-client.ts`**

- `request<T>(path, { method, body, schema })` — envelope 파싱, 에러 메시지 추출, zod 검증까지 한 곳에서. `auth-api.ts`의 `postAuth`가 이걸 쓰도록 리팩터.
- 토큰 자동 첨부: `useAuthStore.getState().token`.

**`src/lib/auth-store.ts` 수정**: 지금은 `isAuthenticated`만 들고 있고 토큰은 SecureStore에만 있다. 매 요청마다 SecureStore를 읽는 건 느리므로 스토어에 `token: string | null`을 함께 둔다(`hydrate`/`login`/`logout` 모두 갱신). SecureStore는 계속 영속 계층으로 유지.

**신규 `src/lib/couple-api.ts`, `src/lib/memory-api.ts`** — zod 스키마 + `request()` 호출만. 얇게.

### 3-2. 라우팅

`src/app/_layout.tsx`의 `Stack.Protected` 패턴을 그대로 확장한다. 커플 소속 여부라는 **세 번째 상태**가 생기므로:

```
(auth)/          — 로그인·회원가입 (isAuthenticated === false)
(onboarding)/    — 커플 생성 / 초대코드 입력 (인증 O, 커플 X)
(app)/           — 타임라인 / 추억작성 / 설정 (인증 O, 커플 O)
```

- 커플 소속 여부는 `GET /couples/me`를 TanStack Query로 조회해 판단. `useCouple()` 훅 하나로 감싼다. 응답 zod 스키마는 `.nullable()` — `data === null`이면 온보딩, 에러 경로 없음.
- 로딩 중에는 스플래시 유지 — 기존 `AnimatedSplashOverlay` + `SplashScreen.preventAutoHideAsync()` 흐름 재사용.

### 3-3. 화면

| 경로                             | 내용                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `(auth)/login.tsx`, `signup.tsx` | 기존 파일 유지. signup에 닉네임 필드 추가                                                        |
| `(onboarding)/index.tsx`         | "커플 만들기" / "초대코드로 참여" 분기                                                           |
| `(onboarding)/create.tsx`        | 커플 이름 + 기념일 → 생성 후 초대코드 표시·공유                                                  |
| `(onboarding)/join.tsx`          | 6자리 코드 입력                                                                                  |
| `(app)/index.tsx`                | **타임라인** — `visited_at` 기준 목록, 날짜 헤더로 그룹핑, 작성자 닉네임                         |
| `(app)/memory/new.tsx`           | 추억 작성 — 제목/설명/방문일/장소명                                                              |
| `(app)/memory/[id].tsx`          | 상세 + 수정/삭제                                                                                 |
| `(app)/settings.tsx`             | 커플 정보, **D-Day 카운터**(`anniversary_date` 클라이언트 계산 — 백엔드 0줄), 초대코드, 로그아웃 |

- 폼은 전부 기존 스택 그대로: `react-hook-form` + `@hookform/resolvers` + zod.
- 스타일은 NativeWind. `src/components/themed-text.tsx` / `themed-view.tsx` 재사용.
- 탭 바는 기존 `src/components/app-tabs.tsx`를 타임라인/작성/설정 3탭으로 수정.
- 뮤테이션 후 `queryClient.invalidateQueries({ queryKey: ['memories'] })`로 갱신.

### 3-4. 정리

`(app)/explore.tsx`, `src/components/web-badge.tsx`, `hint-row.tsx` 등 템플릿 데모 잔재는 삭제한다.

---

## 4단계 — 문서

- **`docs/plan.md`에 이 계획서를 그대로 커밋한다.** 1단계 레포 세팅 직후, 코드보다 먼저. 아래 "재검토 항목"을 여기서 계속 갱신하면서 진행 상황과 결정 변경 이력을 남긴다. (기존 little-pieces가 `PLANS.md`를 두던 자리)
- 루트 `README.md`를 little-pieces 기준으로 다시 씀(구조, 실행법, 엔드포인트 목록, 2차 로드맵).
- `apps/mobile/AGENTS.md`(Expo 버전 문서 링크)는 그대로 유지.

---

## 재검토 항목 (진행하면서 다시 볼 것)

착수 전에 답이 필요하진 않지만, 해당 단계에 도달하면 결정해야 하는 것들. `docs/plan.md`에서 계속 업데이트한다.

**1단계**

- [ ] `legacy-nest` 백업 브랜치가 실제로 생성됐는지 확인 후에만 main 교체
- [ ] `.gitignore`에 `apps/api/.env`가 있는지 확인 (rn-template 기본값 확인 필요)

**2단계 (백엔드)**

- [ ] `users.nickname`을 `NOT NULL DEFAULT ''`로 넣으면 기존 행(있다면)이 빈 닉네임이 됨 — 로컬 DB를 새로 만들 거면 default 없이 `NOT NULL`로 가는 게 깔끔
- [ ] 커플 해제/탈퇴(`DELETE /couples/me`)를 MVP에 넣을지. 잘못 연동했을 때 되돌릴 방법이 없으면 실사용에서 막힌다 — MVP 후보로 재검토
- [ ] 초대 코드 만료(TTL)를 둘지. MVP는 무기한이 단순하지만 코드가 영구 노출됨
- [ ] `visited_at`을 `DATE`로 할지 `TIMESTAMPTZ`로 할지 — 시간까지 기록할 계획이면 지금 정해야 마이그레이션이 한 번으로 끝남

**3단계 (모바일)**

- [ ] 토큰 만료(401) 처리 — `api-client.ts`에서 401이면 자동 로그아웃 시킬지
- [ ] 타임라인 페이지네이션 — 추억이 수백 개가 되기 전엔 전체 조회로 충분. 언제 `useInfiniteQuery`로 바꿀지
- [ ] 온보딩에서 초대코드 공유 방식 (`expo-sharing` / 딥링크 `littlepieces://join?code=`)

**배포 (MVP 이후)**

- [ ] DB 호스팅 확정 — Supabase(Storage 묶기 쉬움) vs Neon(scale-to-zero). 둘 다 `DATABASE_URL` 교체로 끝나므로 지금 정하지 않음
- [ ] API 배포처 (Fly.io / Railway / Render)
- [ ] EAS 빌드 프로필 실사용 설정 (`apps/mobile/eas.json`은 지금 골격만 있음)

---

## 검증

각 단계가 끝날 때마다:

```bash
# 백엔드
docker compose up -d db
pnpm api:dev                 # 최초 실행 시 마이그레이션 자동 적용
cd apps/api && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test

# 모바일
pnpm --filter mobile typecheck
pnpm --filter mobile lint
pnpm --filter mobile test
pnpm --filter mobile format:check
```

**엔드투엔드 시나리오** (curl 스크립트 한 개로 자동화 — 커플 연동은 계정 2개가 필요해 수동으로 하기 번거롭다):

1. A 회원가입 → 토큰
2. A가 `POST /couples` → `invite_code` 획득
3. B 회원가입 → 토큰
4. B가 `POST /couples/join`으로 코드 입력 → 성공
5. B가 다시 join 시도 → **409** (`user_id` UNIQUE 제약 확인)
6. A가 `POST /memories` → B가 `GET /memories`로 **보임** 확인
7. C 회원가입 → C가 **자기 커플을 생성** → C가 `GET /memories/:id`(A의 추억) → **404**
   - C가 커플 없이 호출하면 `CoupleMember` 추출기가 403으로 먼저 막아 정작 검증하려던 걸 못 본다. 커플을 만들어야 `WHERE id = $1 AND couple_id = $2`가 실제로 격리하는지 확인된다.

**앱 확인**: `pnpm --filter mobile ios`(dev client 필요 — `react-native-mmkv` 때문에 Expo Go 불가)로 회원가입 → 커플 생성 → 추억 등록 → 타임라인 표시까지 직접 확인.

---

## 2차 이후 로드맵

1. **지도** — `react-native-maps` + Android용 Google Maps API 키. `latitude/longitude`는 이미 저장 중. 작성 화면에 위치 선택 추가.
2. **이미지** — R2 presigned PUT. `POST /memories/:id/upload-url`이 서명한 URL을 주고 앱이 R2로 직접 PUT. 서버는 바이트를 만지지 않음. `memories.image_keys TEXT[]` 컬럼은 이때 마이그레이션으로 추가(MVP에서 미리 만들지 않는다 — 안 쓰는 컬럼이 모든 `query_as!`에 `Vec<String>` 매핑을 강요한다).
3. **푸시** — `expo-notifications` + `push_tokens` 테이블. 파트너가 추억을 올릴 때 Expo Push API로 POST(요청 스코프라 스케줄러 불필요).
4. **"n년 전 오늘"** — `EXTRACT(MONTH FROM visited_at)` 쿼리 하나. 3번의 푸시 경로 재사용.
