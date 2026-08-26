#!/usr/bin/env bash
# 커플 연동은 계정이 둘 필요해서 손으로 확인하기 번거롭다. 한 번에 돌린다.
#
#   docker compose up -d db && pnpm api:dev   # 다른 터미널
#   ./apps/api/scripts/e2e.sh
set -euo pipefail

API="${API_URL:-http://localhost:3000}"
STAMP=$(date +%s)

# $1 기대 status, $2 설명, $3.. curl 인자. 본문은 전역 BODY에 남긴다.
check() {
  local expected="$1" label="$2"; shift 2
  local response status
  response=$(curl -sS -w '\n%{http_code}' "$@")
  status="${response##*$'\n'}"
  BODY="${response%$'\n'*}"

  # 출력은 stderr로. signup()처럼 $(...)로 감싸 부르는 곳에서
  # 진행 로그가 반환값(토큰)에 딸려 들어가면 안 된다.
  if [ "$status" != "$expected" ]; then
    echo "✖ $label — expected $expected, got $status" >&2
    echo "  $BODY" >&2
    exit 1
  fi
  echo "✓ $label ($status)" >&2
}

json() { printf '%s' "$BODY" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=process.argv[1].split(".").reduce((a,k)=>a?.[k],JSON.parse(s));process.stdout.write(String(v??""))})' "$1"; }

signup() {
  check 200 "회원가입 $1" -X POST "$API/auth/signup" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1-$STAMP@test.com\",\"password\":\"password123\",\"nickname\":\"$1\"}"
  json data.token
}

echo "== $API ==" >&2
check 200 "health" "$API/health"

A_TOKEN=$(signup a)
B_TOKEN=$(signup b)
C_TOKEN=$(signup c)
D_TOKEN=$(signup d)

check 200 "A: 커플 없음 → data null" "$API/couples/me" -H "Authorization: Bearer $A_TOKEN"
[ "$(json data)" = "" ] || { echo "✖ data가 null이 아님: $BODY" >&2; exit 1; }

check 200 "A: 커플 생성" -X POST "$API/couples" -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"우리","anniversaryDate":"2024-05-01"}'
CODE=$(json data.inviteCode)
echo "  초대 코드: $CODE" >&2

check 409 "A: 이미 커플 있음 → 재생성 거부" -X POST "$API/couples" -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"둘째"}'

check 404 "B: 없는 코드로 참여 실패" -X POST "$API/couples/join" -H "Authorization: Bearer $B_TOKEN" \
  -H 'Content-Type: application/json' -d '{"inviteCode":"ZZZZZZ"}'

# 소문자/공백을 흘려 넣어도 정규화되는지 함께 본다.
check 200 "B: 초대 코드로 참여" -X POST "$API/couples/join" -H "Authorization: Bearer $B_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"inviteCode\":\" $(printf '%s' "$CODE" | tr 'A-Z' 'a-z') \"}"

check 409 "B: 중복 참여 거부 (user_id UNIQUE)" -X POST "$API/couples/join" -H "Authorization: Bearer $B_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"inviteCode\":\"$CODE\"}"

# D는 아직 커플이 없다 — AlreadyInCouple이 아니라 CoupleFull 경로를 태우려면 필요하다.
check 409 "D: 정원 찬 커플에 참여 거부 (CoupleFull)" -X POST "$API/couples/join" -H "Authorization: Bearer $D_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"inviteCode\":\"$CODE\"}"
case "$(json error)" in
  *"두 명"*) ;;
  *) echo "✖ CoupleFull이 아니라 다른 409였다: $BODY" >&2; exit 1 ;;
esac

check 200 "C: 자기 커플 생성" -X POST "$API/couples" -H "Authorization: Bearer $C_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"남의커플"}'

check 200 "A: 추억 등록" -X POST "$API/memories" -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"첫 데이트","description":"비 왔음","placeName":"성수","latitude":37.5445,"longitude":127.0557,"visitedAt":"2024-05-01"}'
MEMORY_ID=$(json data.id)

check 400 "A: 위도만 보내면 거부" -X POST "$API/memories" -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"반쪽 좌표","latitude":37.5,"visitedAt":"2024-05-02"}'

check 200 "B: 파트너 추억이 타임라인에 보임" "$API/memories" -H "Authorization: Bearer $B_TOKEN"
[ "$(json data.0.authorNickname)" = "a" ] || { echo "✖ 작성자 닉네임이 안 붙음: $BODY" >&2; exit 1; }

check 404 "C: 남의 커플 추억 조회 불가" "$API/memories/$MEMORY_ID" -H "Authorization: Bearer $C_TOKEN"

check 200 "B: 추억 수정" -X PUT "$API/memories/$MEMORY_ID" -H "Authorization: Bearer $B_TOKEN" \
  -H 'Content-Type: application/json' -d '{"title":"첫 데이트 (수정)","visitedAt":"2024-05-01"}'
[ "$(json data.title)" = "첫 데이트 (수정)" ] || { echo "✖ 수정 반영 안 됨: $BODY" >&2; exit 1; }

check 404 "C: 남의 커플 추억 삭제 불가" -X DELETE "$API/memories/$MEMORY_ID" -H "Authorization: Bearer $C_TOKEN"

check 401 "토큰 없이 접근 거부" "$API/memories"

check 200 "B: 커플에서 나가기" -X DELETE "$API/couples/me" -H "Authorization: Bearer $B_TOKEN"
check 403 "B: 나간 뒤 추억 접근 불가" "$API/memories" -H "Authorization: Bearer $B_TOKEN"
check 200 "A: 남은 멤버는 그대로" "$API/memories" -H "Authorization: Bearer $A_TOKEN"

check 200 "A: 마지막 멤버도 나가기" -X DELETE "$API/couples/me" -H "Authorization: Bearer $A_TOKEN"
check 200 "A: 커플 사라짐 → data null" "$API/couples/me" -H "Authorization: Bearer $A_TOKEN"
[ "$(json data)" = "" ] || { echo "✖ 커플이 남아있음: $BODY" >&2; exit 1; }

check 200 "A: 새 커플 생성 가능" -X POST "$API/couples" -H "Authorization: Bearer $A_TOKEN" \
  -H 'Content-Type: application/json' -d '{"name":"다시"}'

echo >&2
echo "✓ 전부 통과" >&2
