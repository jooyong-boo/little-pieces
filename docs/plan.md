# little-pieces 2차 — 사진 업로드 (그리고 한글 경로 정리)

## Context

1차(인증 + 커플 연동 + 추억 CRUD + 타임라인)는 완료됐다. 커밋 7개가 로컬 `little-pieces` 브랜치에 있고, Rust 20 / jest 16 / API E2E 26 / Maestro 앱 플로우까지 통과했다. (원격 `main`은 아직 NestJS 트리 `6ddfa0d` — 교체는 별건이고 2차 의존성이 아니다.)

2차는 사진 업로드다. 날짜·장소·메모만 있는 추억은 얇고, 커플 앱에서 사진은 부가 기능이 아니라 본체에 가깝다.

**순서를 로드맵과 바꾼 이유**: 검증 가능 범위가 기능마다 다르다.

| 기능       | 시뮬레이터 검증                                                            |
| ---------- | -------------------------------------------------------------------------- |
| **이미지** | 전부 가능 (피커 → presigned PUT → 표시). Maestro로도 구동                  |
| 지도       | iOS는 Apple Maps로 키 없이 렌더. Android는 Google Maps 키 없이는 확인 불가 |
| 푸시       | EAS `projectId` 필요 + APNs 등록은 시뮬레이터 불가 → 실기기 필요           |

1차에서 실기기 구동이 정적 검사가 전부 통과시킨 버그 3개를 잡았다. 증명 가능한 것부터 가는 게 그 교훈이다. 이미지 → 지도 → 푸시.

### 확정된 결정

| 항목      | 결정                                                                 |
| --------- | -------------------------------------------------------------------- |
| 경로      | `개인플젝` → `little-pieces`로 rename. **네이티브 빌드의 선결 조건** |
| 2차 범위  | 이미지만. 지도·푸시는 각각 별 단계                                   |
| 스토리지  | S3 호환. 로컬은 **MinIO**(docker), 배포는 R2 — env 3줄 차이          |
| Rust S3   | `rusty-s3` 0.10.2                                                    |
| 푸시 검증 | 실기기 iPhone 있음 → 3단계에서 활용                                  |

### 검증한 사실 (추측 아님)

- `rusty-s3` 0.10.2 — 기본 feature가 `rustcrypto`(순수 Rust, C 툴체인 불필요)라 sqlx의 `tls-rustls`와 충돌 없음. Sans-IO라 HTTP 클라이언트를 안 끌고 옴. `bucket.put_object(Some(&creds), key).sign(duration)` → presigned URL. MinIO 호환성을 커밋마다 CI로 검증하는 크레이트.
- `expo-image-picker` 57.0.13 — `launchImageLibraryAsync({ allowsMultipleSelection, selectionLimit, quality, mediaTypes })`. asset에 `uri`, `mimeType?`, `fileName?`, `fileSize?`. **`mimeType`이 optional이라 폴백이 필요하다.**
- `expo-file-system` 57.0.5 — `new File(uri).upload(url, { httpMethod: 'PUT', headers })`. 기본 `uploadType`이 `BINARY_CONTENT`. **비2xx도 reject가 아니라 resolve하므로 `result.status`를 직접 봐야 한다.** 지금은 transitive 의존성이라 명시적으로 추가해야 함.
- 플러그인 옵션: `["expo-image-picker", { photosPermission, cameraPermission: false, microphonePermission: false }]` — `false`는 해당 권한을 아예 막는다. 사진 라이브러리만 쓰므로 카메라·마이크는 막는다.
- CocoaPods 1.16.2, Ruby `default_external`은 이미 UTF-8인데도 실패 → CocoaPods가 명령 출력을 BINARY로 강제하는 것이라 환경변수로는 못 푼다. 경로 변경이 유일한 해법.

---

## 진행 상황 (2026-08-26)

- [x] **1단계 백엔드** — presigned PUT/GET, `image_keys` 마이그레이션, `POST /memories/upload-url`,
      커플 스코프 키 검증. Rust 테스트 30개, E2E 검사 30개 + 본문 단정 6개 통과(실제 MinIO 업로드 →
      바이트 왕복 비교 → 타 커플 키 403 포함).
- [x] **2단계 모바일 코드** — 피커·업로드·ImageStrip·타임라인 썸네일. typecheck/lint/jest 29개 통과.
- [ ] **0단계 경로 정리** — 아직. 백엔드와 모바일 코드는 한글 경로에서도 전부 검증됐지만
      **네이티브 빌드(`pod install`)만 막혀 있어 실기기/시뮬레이터 구동을 못 했다.**
- [ ] **Maestro 사진 플로우** — 앱을 빌드할 수 있게 된 뒤에 작성한다. 네이티브 사진 피커의
      실제 레이블을 보지 않고 쓰면 추측이 된다.

---

## 0단계 — 한글 경로 정리 (사용자 실행 + 세션 재시작)

이 세션의 작업 디렉터리가 바로 그 한글 경로다. 이름을 바꾸는 순간 셸이 갈 곳을 잃으므로 **내가 실행할 수 없다.** Orca에서 이 프로젝트의 터미널/탭을 닫은 뒤 아래를 한 번에 실행하고, 새 경로에서 Claude Code를 다시 띄운 다음 "계속"이라고 하면 1단계부터 이어간다.

```bash
mv ~/orca/projects/개인플젝      ~/orca/projects/little-pieces
mv ~/orca/workspaces/개인플젝    ~/orca/workspaces/little-pieces

# 워크트리 링크는 양방향이다. 한쪽만 고치면 반대쪽이 옛 경로를 가리킨 채 남는다:
#   <워크트리>/.git                        → projects/.../worktrees/little-pieces
#   .git/worktrees/little-pieces/gitdir    → <워크트리>/.git
# 양쪽에서 돌린다. 이미 맞으면 각각 no-op이다.
git -C ~/orca/projects/little-pieces worktree repair \
    ~/orca/workspaces/little-pieces/little-pieces
git -C ~/orca/workspaces/little-pieces/little-pieces worktree repair

cd ~/orca/workspaces/little-pieces/little-pieces
# pnpm의 hoisted 레이아웃은 .bin 심링크에 절대경로를 굽는다
rm -rf node_modules apps/mobile/ios apps/mobile/android
pnpm install

# 검증: 워크트리 자신이 정상인지를 본다.
# main 쪽 `git worktree list`만 보면 워크트리가 깨져 있어도 멀쩡해 보일 수 있다.
git status && git log --oneline -1
```

확인·부작용:

- **Orca**는 `~/orca/projects/*`, `~/orca/workspaces/*` 디렉터리 구조를 그대로 쓴다. 경로가 박힌 건 통계·로그·터미널 히스토리(`~/Library/Application Support/orca/`)뿐이라 이름이 바뀌면 그것만 새로 쌓인다. 별도 레지스트리 수정은 불필요.
- `target/`은 굳이 지우지 않는다 — cargo가 절대경로를 fingerprint에 포함하므로 필요한 것만 알아서 다시 빌드한다. 빌드가 이상하게 굴면 그때 `rm -rf target`.
- Claude Code의 프로젝트 키가 바뀌므로 이전 세션 히스토리와 자동 메모리가 새 키로 갈린다. 새 세션이 만드는 디렉터리 이름을 `ls ~/.claude/projects/`로 확인한 뒤 옛 `memory/` 폴더를 그쪽으로 옮긴다(키 인코딩 규칙을 미리 예측하지 말 것).
- `~/.claude.json`의 옛 경로 항목은 남지만 무해하다.
- 이후 `apps/mobile/ios`는 `expo run:ios`가 prebuild로 다시 만든다.

**완료 판정**: `cd apps/mobile && npx expo run:ios --device "iPhone 17 Pro"`가 `pod install`을 통과한다. 여기가 막히면 2단계 이후는 검증할 수 없으므로 진행하지 않는다.

---

## 1단계 — 백엔드 스토리지 (`apps/api`)

### 1-1. 의존성 · 설정

`apps/api/Cargo.toml`

```toml
rusty-s3 = "0.10.2"
```

기본 feature(`rustcrypto` + `full`) 그대로 간다. `rustcrypto`만 남기면 크레이트 4개(xml/serde_json/md-5/base64)를 덜 받지만, SigV4 서명이 base64를 쓰고 그게 `full` 뒤에 가려져 있어 1단계 첫 빌드부터 깨질 소지가 있다. **일단 돌게 만들고, 트리밍은 통과한 뒤 선택 정리로 남긴다.**

`config.rs` — `Config`에 `s3: Option<S3Config>` 추가. **전부 있으면 `Some`, 하나라도 없으면 `None`.** 스토리지 미설정 상태로도 서버가 뜨고 나머지 기능이 도는 게 중요하다(R2 계정이 아직 없다).

`state.rs` — `AppState`에 `storage: Option<Storage>`.

`.env.example` — MinIO 기준 기본값 + R2 전환 방법을 주석으로:

```
S3_ENDPOINT=http://localhost:9000
S3_REGION=auto
S3_BUCKET=little-pieces
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
# R2로 갈 때: endpoint를 https://<account_id>.r2.cloudflarestorage.com 로,
# 키를 R2 API 토큰으로. region은 auto 그대로. 코드 변경 없음.
```

`docker-compose.yml` — `minio` 서비스(9000/9001) + `mc mb`로 버킷을 만드는 일회성 `minio-init`. 5432가 이미 점유돼 5433으로 옮겼던 것처럼 9000이 겹치면 포트만 바꾼다.

### 1-2. 마이그레이션

`migrations/<ts>_add_memory_images.up.sql`

```sql
ALTER TABLE memories ADD COLUMN image_keys TEXT[] NOT NULL DEFAULT '{}';
```

1차에서 의도적으로 미뤘던 컬럼이다. `.down.sql`은 `DROP COLUMN`.

### 1-3. `apps/api/src/storage.rs` (신규)

`UrlStyle::Path`를 쓴다 — MinIO는 path-style이 필요하고 R2도 지원하므로 한 설정으로 둘 다 커버된다.

```rust
pub struct Storage { bucket: Bucket, credentials: Credentials, url_ttl: Duration }

impl Storage {
    pub fn from_env() -> Option<Self>
    pub fn presign_put(&self, key: &str) -> String
    pub fn presign_get(&self, key: &str) -> String
}

// 순수 함수 — 신뢰 경계 두 곳
pub fn image_key(couple_id: Uuid, content_type: &str) -> Result<String, AppError>
pub fn is_owned_by(couple_id: Uuid, key: &str) -> bool
```

**`image_key`** — content type 허용 목록으로만 확장자를 정한다(`image/jpeg`→`jpg`, `image/png`→`png`, `image/webp`→`webp`, `image/heic`→`heic`). 그 밖은 `UnsupportedImageType`. 키는 `couples/{couple_id}/{uuid}.{ext}` — **서버가 만든다.** 클라이언트가 키를 정하면 남의 객체를 덮어쓸 수 있다.

**`is_owned_by`** — 여기가 이 단계에서 가장 중요한 검사다. 추억을 저장할 때 클라이언트가 보낸 `imageKeys`를 그대로 믿으면, A가 B 커플의 키를 적어 넣고 우리가 발급하는 presigned GET으로 남의 사진을 읽을 수 있다. `starts_with(prefix)`로 끝내지 않고 **`couples/<uuid>/<uuid>.<ext>` 형식을 정확히 파싱해서** 커플 ID가 일치하는지 본다(형식이 고정이라 `..` 같은 게 끼어들 여지가 없다).

두 함수 모두 단위 테스트: 허용/거부 content type, 남의 커플 키, `..`가 섞인 키, 접두사만 비슷한 키(`couples/{id}x/...`), 확장자 없는 키.

`error.rs`에 variant 추가: `StorageUnavailable`(503), `UnsupportedImageType`(400), `ForeignImageKey`(403).

### 1-4. 엔드포인트와 응답

**`POST /memories/upload-url`** — `CoupleMember`, body `{ contentType }`, 응답 `{ key, uploadUrl, expiresInSeconds }`.

메모리 ID를 요구하지 않는 게 핵심이다. 신규 작성 화면에서는 추억이 아직 없으므로, ID를 요구하면 "추억 먼저 만들고 → 업로드 → 다시 수정" 3단이 된다. 커플 스코프 키만 있으면 신규·수정이 같은 경로를 쓴다.

`memories/repo.rs`

- `MemoryView`에 `image_keys: Vec<String>`(수정 화면 왕복용) + `image_urls: Vec<String>`(presigned GET, 표시용) 추가. R2/MinIO 버킷은 비공개라 표시에도 서명이 필요하다. 스토리지 미설정이면 `image_urls`는 빈 배열.
- `MemoryInput`에 `image_keys: Vec<String>`.

`memories/handlers.rs` — `MemoryRequest`에 `imageKeys: Option<Vec<String>>`. `to_input`에서 최대 10장 제한 + 전 항목 `is_owned_by` 검사.

`routes.rs`에 라우트 하나 추가.

### 1-5. E2E 확장 (`apps/api/scripts/e2e.sh`)

기존 26개 체크에 이어서:

1. `POST /memories/upload-url`로 URL 받기
2. 받은 URL에 `curl -X PUT --upload-file`로 실제 이미지 바이트 업로드 → 2xx
3. 그 키로 추억 저장 → `imageKeys`에 반영
4. 응답의 `imageUrls[0]`를 `curl`로 GET → 업로드한 바이트와 **동일한지 비교**
5. 허용되지 않는 `contentType`(`application/pdf`) → 400
6. **다른 커플의 키를 넣어 저장 시도 → 403** (`is_owned_by`가 실제로 막는지)

---

## 2단계 — 모바일 (`apps/mobile`)

### 2-1. 의존성 · 권한

```
pnpm --filter mobile add expo-image-picker expo-file-system
```

`app.json` plugins에 추가:

```json
[
  "expo-image-picker",
  {
    "photosPermission": "추억에 사진을 넣으려면 사진 접근 권한이 필요해요.",
    "cameraPermission": false,
    "microphonePermission": false
  }
]
```

카메라·마이크는 쓰지 않으므로 `false`로 아예 막는다.

### 2-2. `src/lib/image-upload.ts` (신규)

```ts
pickImages(remainingSlots: number): Promise<PickedImage[]>   // launchImageLibraryAsync
uploadPickedImage(image: PickedImage): Promise<string>        // → 서버 키
resolveMimeType(image): string                               // 순수 함수 + 테스트
```

- `launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit, quality: 0.7 })`. 휴대폰 사진은 3~5MB라 `quality`로 줄인다.
- **`asset.mimeType`은 optional이다.** `fileName` 확장자 → 그것도 없으면 `image/jpeg`로 폴백하는 순수 함수를 두고 테스트한다. 서버가 content type을 허용 목록으로 검사하므로 여기서 틀리면 400이 난다.
- 업로드는 `new File(asset.uri).upload(uploadUrl, { httpMethod: 'PUT', headers: { 'Content-Type': mime } })`. **비2xx도 resolve하므로 `result.status`를 직접 확인하고 실패를 throw한다** — 안 하면 업로드 실패가 조용히 성공으로 넘어간다.
- `memory-api.ts`에 `requestImageUploadUrl(contentType)` 추가 — 기존 `request()` 재사용.

### 2-3. 업로드 시점

**고른 즉시 업로드한다.** 저장 버튼이 즉시 끝나고 진행 상태를 사진별로 보여줄 수 있다. 대가는 사용자가 작성을 취소했을 때 남는 고아 객체인데, 정리 잡 없이 그냥 둔다(아래 "미루는 것").

### 2-4. 화면

- **`src/components/image-strip.tsx`** (신규) — 썸네일 가로 목록 + `+` 추가 + 각 항목 제거. 업로드 중 스피너, 실패 시 재시도. `expo-image`(이미 의존성)로 표시.
- **`memory-form.tsx`** — `imageKeys` 상태를 들고 `ImageStrip`을 붙인다. 추가/제거는 순수 리듀서 함수로 빼고 테스트한다(10장 상한, 중복 방지).
- **`(tabs)/index.tsx`** — 행에 첫 사진 썸네일. `memoryLabel()`에 "사진 N장"을 더해 스크린리더가 사진 유무를 알 수 있게 한다.
- **`memory/[id].tsx`** — 사진 가로 스크롤 + 수정 시 `ImageStrip` 재사용.

### 2-5. Maestro 플로우

시뮬레이터 사진 라이브러리는 기본이 비어 있다. `xcrun simctl addmedia booted <파일>`로 먼저 씨딩한다.

`apps/mobile/.maestro/memory-with-image.yaml` (신규) — 기존 `signup-to-memory.yaml`은 그대로 두고, 사진 경로만 별도 플로우로. 네이티브 사진 피커 모달을 거치므로 실패 지점이 다르다.

---

## 미루는 것 (누락 아님)

- **고아 객체 정리** — 작성 취소/사진 제거 시 R2 객체가 남는다. 개인 프로젝트 규모에서 무의미한 비용이고, 정리 잡은 스케줄러를 부른다. 지금은 남긴다.
- **`POST /memories/upload-url` 레이트 리밋** — 호출마다 우리 버킷으로 쓸 수 있는 서명 URL이 하나 발급된다. 두 명이 쓰는 앱이라 실제 위협은 아니지만, 인증된 유저가 반복 호출해 객체를 무한정 넣을 수 있는 구조인 건 사실이다. 공개 서비스로 갈 때 커플당 시간당 상한을 건다.
- 서버측 썸네일 생성/리사이즈 — `quality: 0.7`로 1차 완화.
- 여러 장 동시 업로드 진행률 합산 UI — 사진별 상태만 보여준다.
- 이미지 순서 재배치.
- **`+` 버튼 연타** — 두 번 빠르게 누르면 두 호출이 같은 남은 칸 수를 보고, 합쳐서 10장을 넘길 수 있다.
  `addImage`가 상한에서 잘라내므로 데이터가 깨지진 않지만 초과분은 업로드 비용만 쓰고 버려진다.
  버튼을 업로드 중 비활성화하면 끝나는 문제라 필요해지면 그때 막는다.
- **폼이 열려 있는 동안 백그라운드 refetch** — `MemoryForm`은 `initialImages`를 마운트 시점에만
  `useState`로 받는다. 폼이 열린 채 쿼리가 다시 불려오면 방금 올린 사진이 로컬 `file://` uri에
  머문다. 저장 후 바로 `router.back()`하므로 실제로 닿기 어렵지만, 닿는다면 폼을
  `query.data.id`로 keying하는 한 줄이 해법이다.

---

## 검증

```bash
# 0단계 완료 판정 (여기가 막히면 진행 안 함)
cd apps/mobile && npx expo run:ios --device "iPhone 17 Pro"

# 백엔드
docker compose up -d db minio
cd apps/api && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
./apps/api/scripts/e2e.sh        # 기존 26개 + 이미지 6개

# 모바일
pnpm --filter mobile typecheck && pnpm --filter mobile lint
pnpm --filter mobile test && pnpm --filter mobile format:check

# 앱 실제 구동
xcrun simctl addmedia booted <테스트이미지.jpg>
maestro test -e EMAIL="me-$(date +%s)@test.com" apps/mobile/.maestro/signup-to-memory.yaml
maestro test -e EMAIL="me-$(date +%s)@test.com" apps/mobile/.maestro/memory-with-image.yaml
```

E2E에서 반드시 통과해야 하는 두 가지:

- **업로드한 바이트와 presigned GET으로 받은 바이트가 같다** — 서명·헤더·content type이 모두 맞았다는 유일한 증거
- **다른 커플의 키로 저장 시도가 403** — 이게 뚫리면 남의 사진을 읽을 수 있다

작업 중 `docs/plan.md`를 갱신한다(2차 진행 상황 + 남은 재검토 항목).

---

## 다음 단계 (2차 이후)

3. **지도** — `react-native-maps@1.29.0`(peer `react-native >= 0.76`, 우리 0.86 OK). `latitude/longitude`는 이미 저장 중. iOS는 Apple Maps로 키 없이 확인 가능, Android는 Google Maps 키 필요.
4. **푸시** — `expo-notifications@57.0.14` + `push_tokens` 테이블 + Expo Push API. **EAS `projectId`를 먼저 만들어야 한다**(`app.json`에 `extra`가 없음). 실기기 iPhone으로 검증. "n년 전 오늘"(`EXTRACT`)은 이 배달 경로를 재사용하는 곁가지.
