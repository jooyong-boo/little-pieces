# little-pieces

pnpm workspace + turborepo 기반의 커플 추억 공유 지도 서비스 초기 모노레포입니다.

## 버전 기준

- Next.js: `16.1.6`
- NestJS: `11.1.16`
- React: `19.2.4`
- Prisma: `6.19.2` (`7.x`는 `schema.prisma`의 `url/directUrl` 사용 방식과 충돌)
- Node.js: `>=20.9.0` (Next/Nest 요구사항 충족)

## 프로젝트 구조

```text
.
├── apps
│   ├── api
│   │   ├── prisma
│   │   │   └── schema.prisma
│   │   └── src
│   │       ├── auth
│   │       ├── common
│   │       ├── couples
│   │       ├── memories
│   │       ├── prisma
│   │       ├── users
│   │       ├── app.controller.ts
│   │       ├── app.module.ts
│   │       ├── app.service.ts
│   │       └── main.ts
│   └── web
│       ├── app
│       │   ├── (private)
│       │   │   └── map/page.tsx
│       │   ├── (public)
│       │   │   ├── login/page.tsx
│       │   │   └── signup/page.tsx
│       │   ├── globals.css
│       │   ├── layout.tsx
│       │   └── page.tsx
│       └── src
│           ├── app
│           ├── entities
│           ├── features
│           ├── pages-layer
│           ├── shared
│           └── widgets
├── packages
│   ├── eslint-config
│   ├── shared
│   └── typescript-config
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 실행 방법

1. 의존성 설치

```bash
pnpm install
```

2. 개발 서버 실행 (web + api 병렬)

```bash
pnpm dev
```

- web: `http://localhost:3000`
- api: `http://localhost:4000`

3. 품질 체크

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## 앱/패키지 설명

- `apps/web`: Next.js App Router 기반 프론트엔드. 라우팅은 `app/`, FSD-lite 구조는 `src/` 기준으로 분리.
- `apps/web/src/pages-layer`: Next.js 16에서 `app/`와 `src/pages/` 동시 사용이 충돌하므로 pages 레이어를 `pages-layer`로 유지.
- `apps/api`: NestJS + Prisma 기반 백엔드. `PrismaService`를 통해 향후 도메인 모듈에서 DB 접근.
- `packages/shared`: 프레임워크 독립 공통 타입/스키마(zod)/상수.
- `packages/typescript-config`: web/api/shared에서 재사용하는 공통 tsconfig preset.
- `packages/eslint-config`: web/api/shared에서 재사용하는 공통 eslint preset.

## Prisma + Supabase 환경변수

`apps/api/.env.example` 파일을 복사해서 `apps/api/.env`를 만들고 값을 채웁니다.

- `DATABASE_URL`: Supabase **pooler connection string** (`pgbouncer=true`) 용도
- `DIRECT_URL`: migration/DDL 실행을 위한 direct connection (`5432`) 용도
- `PORT`: API 실행 포트

Supabase 프로젝트 생성 후:

1. Project Settings > Database에서 connection string 확인
2. pooler 문자열을 `DATABASE_URL`에 입력
3. direct 문자열을 `DIRECT_URL`에 입력

## 설계 메모

- 인증은 현 단계에서 구현하지 않았고, 향후 NestJS JWT auth로 도입합니다.
- 권한 처리(RLS 포함)는 현재 미구현이며, 우선 NestJS 레이어에서 처리 후 RLS는 후순위로 검토합니다.
- Supabase Auth는 현재 도입하지 않습니다.

## 다음 단계 TODO

1. NestJS JWT auth 구현
2. Prisma 모델(User, CoupleSpace, CoupleMember, Memory) 추가
3. Supabase Postgres 연결 및 migration 실행
4. Next.js login/signup/map 화면과 API 연결
5. 지도 SDK(카카오 또는 네이버) 연결
6. Supabase Storage를 이용한 사진 업로드 검토
7. 권한 처리는 NestJS에서 우선 구현, RLS는 후순위로 검토
