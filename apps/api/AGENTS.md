# Repository Guidelines

## Project Structure & Module Organization
This package is a NestJS API service.

- `src/main.ts`: application bootstrap (`PORT`, CORS setup).
- `src/app.module.ts`: top-level module wiring.
- `src/<domain>/`: feature modules (for example `auth`, `users`, `couples`, `memories`), typically with `<domain>.module.ts` and an `index.ts` barrel.
- `src/prisma/`: Prisma integration (`prisma.module.ts`, `prisma.service.ts`).
- `prisma/schema.prisma`: database schema and client generation source.
- `dist/`: compiled output from TypeScript builds. Do not edit manually.

## Build, Test, and Development Commands
Run commands from this directory (`apps/api`):

- `pnpm dev`: start local dev server with `tsx watch`.
- `pnpm build`: compile TypeScript to `dist/`.
- `pnpm start` or `pnpm start:prod`: run compiled server.
- `pnpm lint`: run ESLint on `src/**/*.ts`.
- `pnpm typecheck`: run TypeScript checks without emitting files.
- `pnpm prisma:generate`: regenerate Prisma client.
- `pnpm prisma:migrate`: create/apply local migrations.
- `pnpm prisma:studio`: open Prisma Studio for local data inspection.

## Coding Style & Naming Conventions
- Language: TypeScript with NestJS patterns.
- Formatting: 2-space indentation, semicolons, single quotes.
- Naming:
  - Files/folders use lowercase domain names (`users`, `memories`).
  - Nest classes use PascalCase (`UsersModule`, `PrismaService`).
  - Keep module boundaries clear; place domain-specific code inside its domain folder.
- Lint config is shared via `@little-pieces/eslint-config/nest`; fix lint issues before opening a PR.

## Testing Guidelines
There is currently no dedicated `test` script or test framework configured in this package. Until tests are introduced:

- Treat `pnpm lint` and `pnpm typecheck` as required quality gates.
- For new logic-heavy code, add tests alongside the feature where practical using `*.spec.ts` naming so test adoption is straightforward.

## Commit & Pull Request Guidelines
- Follow Conventional Commits, matching existing history (for example `chore: ...`).
- Recommended format: `<type>: <imperative summary>` (example: `feat: add memories module endpoints`).
- PRs should include:
  - concise change summary,
  - linked issue/task,
  - local verification steps run (for example `pnpm lint && pnpm typecheck && pnpm build`),
  - API contract notes when request/response behavior changes.

## Security & Configuration Tips
- Keep secrets in `.env`; never commit credentials.
- Current runtime-sensitive variables include `DATABASE_URL`, `DIRECT_URL`, `PORT`, and `CORS_ORIGIN`.
- In production, prefer explicit `CORS_ORIGIN` values instead of wildcard behavior.
