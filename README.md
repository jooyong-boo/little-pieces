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
│       └── src
├── packages
│   ├── eslint-config
│   ├── shared
│   └── typescript-config
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 로컬 실행 (모노레포 루트 기준)

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

## 배포 전략 (추후 배포 가능 구조)

- 모노레포는 유지하지만, 배포는 앱별로 분리합니다.
- `apps/web`은 Vercel에 독립 배포합니다. (Vercel project root: `apps/web`)
- `apps/api`는 Railway에 독립 배포합니다. (Railway service root: `apps/api`)
- DB는 Supabase Postgres를 사용합니다.
- ORM 레이어는 Prisma를 유지합니다.
- 루트 `package.json`의 스크립트(`pnpm dev`, `pnpm build`)는 로컬 개발/검증용이며, 실제 플랫폼 배포는 각 앱 디렉터리 단위로 수행합니다.
- 현재 문서는 "지금 당장 배포 자동화"가 아니라 "추후 배포 가능 구조"를 정리한 상태입니다.

## 앱별 배포 스크립트

### apps/web (Vercel)

- `pnpm build` 또는 `pnpm build:vercel`: Next.js production build
- `pnpm start` 또는 `pnpm start:preview`: 로컬/프리뷰 실행 (`PORT` 기본값 `3000`)

### apps/api (Railway)

- `pnpm build`: NestJS build (`dist/main.js`)
- `pnpm build:railway`: Railway 배포 전 Prisma Client generate + build
- `pnpm start` / `pnpm start:prod`: production start
- `pnpm start:railway`: Railway start용 alias
- `pnpm prisma:generate`: Prisma Client generate

API health check endpoint:

- `GET /`
- `GET /health`

## 환경변수

### apps/web/.env

`apps/web/.env.example`을 복사해서 사용합니다.

- `NEXT_PUBLIC_API_BASE_URL`: web에서 호출할 API base URL

### apps/api/.env

`apps/api/.env.example`을 복사해서 사용합니다.

- `PORT`: API 실행 포트
- `DATABASE_URL`: Supabase pooler connection string (`pgbouncer=true`)
- `DIRECT_URL`: Prisma migration/DDL용 direct connection (`5432`)
- `JWT_SECRET`: JWT 서명 키 placeholder
- `CORS_ORIGIN`: 허용할 origin 목록(쉼표 구분 가능)

예시:

```bash
cp apps/api/.env.example apps/api/.env
```

## Prisma + Supabase + Railway 메모

- Supabase는 DB(Postgres) 역할만 사용합니다.
- Prisma는 애플리케이션 ORM 레이어로 유지합니다.
- Railway 배포 시 `build:railway` 스크립트로 Prisma Client generate를 보장합니다.
- 로컬에서 연동 확인은 API 실행 후 `GET /health`로 확인합니다. `database.status`가 `connected`여야 정상입니다.

## 앱/패키지 설명

- `apps/web`: Next.js App Router 기반 프론트엔드.
- `apps/web/src/pages-layer`: Next.js 16에서 `app/`와 `src/pages/` 동시 사용 충돌 회피용 레이어.
- `apps/api`: NestJS + Prisma 기반 백엔드.
- `packages/shared`: 프레임워크 독립 공통 타입/스키마(zod)/상수.
- `packages/typescript-config`: web/api/shared 공통 tsconfig preset.
- `packages/eslint-config`: web/api/shared 공통 eslint preset.
