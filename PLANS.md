너는 시니어 풀스택 엔지니어다.
아래 요구사항에 맞춰 monorepo 초기 구조를 생성해라.

# 목표

pnpm workspace + turborepo 기반 monorepo를 구성한다.

프로젝트 구성:

- apps/web: Next.js (App Router 사용)
- apps/api: NestJS
- packages/shared: 프론트/백엔드 공통 타입, 스키마, 유틸을 위한 shared package
- packages/typescript-config: 공통 tsconfig
- packages/eslint-config: 공통 eslint 설정

최종 목표는 "커플 추억 공유 지도 서비스"의 초기 개발 뼈대를 만드는 것이다.
지금 단계에서는 서비스 기능 구현보다 구조와 실행 가능 상태가 더 중요하다.

# 핵심 기술 스택

- package manager: pnpm
- monorepo/task runner: turborepo
- frontend: Next.js App Router
- backend: NestJS
- database access: Prisma
- database provider: Supabase Postgres
- optional storage later: Supabase Storage

# 반드시 지켜야 할 원칙

1. 패키지 매니저는 pnpm만 사용한다.
2. 빌드/태스크 러너는 turborepo를 사용한다.
3. web은 Next.js App Router를 사용한다.
4. web 내부 구조는 FSD-lite를 고려한다.
5. api는 NestJS + Prisma 기반으로 구성한다.
6. api는 Supabase를 "DB 제공자(Postgres)"로 사용하는 전제를 고려한다.
7. shared package는 프레임워크 독립적으로 유지한다.
    - Nest의 class-validator DTO를 shared로 직접 옮기지 않는다.
    - 대신 plain TypeScript type, zod schema, 공통 상수 중심으로 구성한다.
8. 과도한 추상화 금지:
    - packages는 shared, typescript-config, eslint-config 정도만 만든다.
    - ui, hooks, core 같은 package를 불필요하게 만들지 않는다.
9. 바로 실행 가능해야 한다.
    - 루트에서 pnpm install 후
    - pnpm dev로 web과 api가 함께 실행되도록 구성한다.
10. README를 생성해서 실행 방법과 구조 설명을 적는다.
11. TypeScript 기반으로 작성한다.

# 중요한 백엔드 제약 사항

NestJS 쪽은 반드시 Prisma를 기준으로 구조를 잡아라.

다음 사항을 반영하라:

- apps/api 내부에 prisma 폴더를 둔다.
- prisma/schema.prisma 파일을 포함한다.
- Prisma datasource는 PostgreSQL 기준으로 작성한다.
- Supabase 환경을 고려하여 DATABASE_URL, DIRECT_URL 환경변수 구조를 사용한다.
- README 또는 .env.example 에 아래 개념을 설명한다:
    - DATABASE_URL: Supabase pooler connection string 용도
    - DIRECT_URL: migration / direct connection 용도
- PrismaService 뼈대를 만든다.
- 향후 auth/couples/memories 모듈에서 PrismaService를 주입받을 수 있도록 구조를 잡는다.

주의:

- 지금 단계에서 실제 auth 구현은 하지 않아도 되지만, Prisma를 붙일 수 있는 구조는 확실히 만들어라.
- TypeORM은 절대 사용하지 않는다.
- Supabase Auth는 지금 단계에서 도입하지 않는다.
- 인증은 향후 NestJS 자체 JWT auth로 구현할 예정이라는 전제를 README TODO에 명시한다.
- RLS(Row Level Security)는 지금 단계에서 구현하지 않는다. 권한 처리는 향후 NestJS 레이어에서 다룰 예정이라고 정리한다.

# 원하는 최종 디렉토리 구조

다음과 비슷한 구조를 만들어라.

root/
apps/
web/
api/
packages/
shared/
typescript-config/
eslint-config/
package.json
pnpm-workspace.yaml
turbo.json
README.md

그리고 apps/api 내부는 대략 아래 구조를 갖게 하라.

apps/api/
src/
main.ts
app.module.ts
common/
prisma/
prisma.module.ts
prisma.service.ts
auth/
users/
couples/
memories/
prisma/
schema.prisma
.env.example
package.json

# apps/web 요구사항

Next.js App Router 기반으로 생성한다.
단, FSD-lite를 고려하여 아래 구조를 반영한다.

apps/web/
app/
(public)/
login/page.tsx
signup/page.tsx
(private)/
map/page.tsx
layout.tsx
page.tsx
globals.css
src/
app/
providers/
styles/
pages/
widgets/
features/
auth/
couple/
memory/
map/
entities/
user/
couple/
memory/
marker/
shared/
api/
config/
lib/
ui/
types/

주의:

- Next의 app/ 는 라우팅 전용으로 사용한다.
- FSD의 app layer는 src/app 으로 둔다.
- FSD를 과하게 적용하지 말고, FSD-lite 수준으로 최소 뼈대만 만든다.
- 초기 페이지는 최소한 landing(/), login(/login), signup(/signup), map(/map) 정도만 만든다.
- 로그인 상태 관리나 실제 auth 구현은 하지 말고, placeholder 수준의 UI만 만든다.
- web은 추후 TanStack Query를 붙이기 쉽게 구조를 잡되, 지금 당장 설치가 필수는 아니다.
- alias 설정(@/\* 등)을 적절히 구성한다.

# apps/api 요구사항

NestJS 기반 TypeScript 앱을 만든다.

초기 구조는 아래 확장을 고려하라:
apps/api/src/
main.ts
app.module.ts
common/
prisma/
auth/
users/
couples/
memories/

그리고 Prisma/Supabase 관점에서 다음 파일을 반드시 포함하라:

- prisma/schema.prisma
- src/prisma/prisma.module.ts
- src/prisma/prisma.service.ts
- .env.example

주의:

- 지금은 NestJS가 정상 실행되는 최소 상태면 된다.
- Health check 성격의 간단한 GET / 엔드포인트가 동작하면 좋다.
- Prisma는 설치 및 기본 연결 준비까지만 해도 된다.
- 실제 DB 연결 로직은 PrismaService 수준까지만 준비해도 된다.
- auth/couples/memories는 placeholder 파일 또는 index 수준으로 두어도 된다.
- eslint/prettier/typescript 세팅이 안정적으로 동작해야 한다.

# prisma/schema.prisma 요구사항

schema.prisma 는 PostgreSQL 기준으로 작성하고 최소 모델은 강제하지 않는다.
하지만 아래 정도는 포함해도 좋다:

- generator client
- datasource db
- 향후 User, CoupleSpace, CoupleMember, Memory 등을 추가할 수 있게 주석 또는 placeholder 안내

예시로 datasource는 이런 개념을 반영하라:

- provider = "postgresql"
- url = env("DATABASE_URL")
- directUrl = env("DIRECT_URL")

# packages/shared 요구사항

공통 타입/스키마/상수용 package를 만든다.

예시 구조:
packages/shared/
src/
index.ts
types/
auth.ts
memory.ts
couple.ts
schemas/
auth.ts
memory.ts
constants/
routes.ts

주의:

- zod를 사용해도 좋다.
- shared는 web과 api 양쪽에서 import 가능해야 한다.
- build 혹은 tsup 없이도 workspace 내부에서 사용할 수 있게 간단히 구성해도 되지만,
  필요하다면 tsc 기반 빌드 구조를 추가해도 된다.
- 단, 너무 무거운 설정은 피한다.

# 공통 설정 요구사항

## pnpm-workspace.yaml

- apps/\*
- packages/\*

## turbo.json

다음 태스크들을 고려하라:

- build
- dev
- lint
- typecheck

web과 api가 병렬로 dev 실행되도록 설정하라.

## root package.json

다음 내용을 포함하라:

- private: true
- packageManager
- scripts:
    - dev
    - build
    - lint
    - typecheck
    - format (선택)
- devDependencies:
    - turbo
    - typescript
    - eslint
    - prettier (선택)

# packages/typescript-config 요구사항

- base.json
- nextjs.json
- nestjs.json
  등으로 나눠도 좋다.
- web과 api가 공통적으로 재사용할 수 있게 작성하라.

# packages/eslint-config 요구사항

- web용
- api용
  공통 확장 가능한 형태로 구성한다.

단, 최근 Next/Nest/ESLint 환경에서 실제로 잘 동작하도록 만들어라.
실행이 안 되는 허세 설정은 금지한다.

# 추가 요구사항

1. 각 앱/패키지에 package.json을 적절히 작성하라.
2. root README.md에 아래 내용을 정리하라:
    - 프로젝트 구조
    - 실행 방법
    - 각 앱/패키지 설명
    - Prisma + Supabase 환경변수 설명
3. import alias와 tsconfig path가 충돌 없이 동작하게 하라.
4. web/api/shared 간 의존성을 명확하게 정리하라.
5. 불필요한 라이브러리는 넣지 마라.
6. 생성 후 "다음 단계로 무엇을 하면 되는지" TODO도 README에 적어라.

# README TODO에 반드시 포함할 다음 단계

1. NestJS JWT auth 구현
2. Prisma 모델(User, CoupleSpace, CoupleMember, Memory) 추가
3. Supabase Postgres 연결 및 migration 실행
4. Next.js login/signup/map 화면과 API 연결
5. 지도 SDK(카카오 또는 네이버) 연결
6. Supabase Storage를 이용한 사진 업로드 검토
7. 권한 처리는 NestJS에서 우선 구현, RLS는 후순위로 검토

# 구현 스타일

- 실용적이고 단순하게
- 지나친 설계 패턴 금지
- 바로 개발 시작 가능한 상태
- 폴더만 만들고 비워두지 말고, 최소 index 파일/placeholder 파일을 넣어라
- 주석은 꼭 필요한 곳에만 작성한다

# 결과물 형식

다음 방식으로 응답하라.

1. 먼저 전체 생성/수정 계획을 아주 짧게 요약
2. 그 다음 각 파일을 실제 생성/수정하는 형태로 출력
3. 각 파일 내용은 완전한 코드로 작성
4. 마지막에 실행 방법을 정리

# 특히 중요

- "이 구조가 좋아 보인다" 수준으로 끝내지 말고 실제 파일 내용을 만들어라.
- placeholder여도 import/export가 깨지지 않게 작성하라.
- monorepo 전체가 일관된 방식으로 동작해야 한다.
- apps/web의 FSD-lite와 Next App Router 구분을 반드시 지켜라.
- apps/api는 NestJS + Prisma + Supabase(Postgres) 전제를 반드시 반영하라.
- TypeORM을 사용하지 마라.
- Supabase Auth를 사용하지 마라.

추가 제약:

- apps/api/.env.example 에 DATABASE_URL, DIRECT_URL, PORT 정도를 포함해라.
- prisma/schema.prisma 는 실제로 동작 가능한 최소 파일로 작성해라.
- PrismaService 는 NestJS에서 일반적으로 사용하는 형태(OnModuleInit 포함)로 작성해라.
- PrismaModule 은 global module 로 구성해도 좋다.
- apps/api package.json 에 prisma 관련 스크립트 예시를 포함해라.
  예:
    - prisma:generate
    - prisma:migrate
    - prisma:studio
- README에 Supabase 프로젝트 생성 후 어떤 URL을 어디에 넣는지 간단히 안내해라.
- web과 api 모두 불필요한 데모/보일러플레이트 파일은 제거해라.
