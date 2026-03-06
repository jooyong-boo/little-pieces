# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` workspace managed with Turborepo.

- `apps/web`: Next.js App Router frontend (`app/` routes, layered code in `src/`).
- `apps/api`: NestJS API (`src/<domain>` modules, Prisma schema at `prisma/schema.prisma`).
- `packages/shared`: Framework-agnostic shared types, constants, and Zod schemas.
- `packages/eslint-config`: Reusable ESLint presets (`next`, `nest`, `shared`).
- `packages/typescript-config`: Shared strict TypeScript presets.

Generated outputs (`.next/`, `dist/`) are build artifacts and should not be edited manually.

## Build, Test, and Development Commands
Run from repository root unless noted:

- `pnpm install`: Install all workspace dependencies.
- `pnpm dev`: Run all app dev servers in parallel through Turbo.
- `pnpm lint`: Run ESLint across workspaces.
- `pnpm typecheck`: Run TypeScript checks across workspaces.
- `pnpm build`: Build all apps/packages.
- `pnpm format`: Apply Prettier formatting.

Workspace-scoped examples:
- `pnpm --filter @little-pieces/web dev`
- `pnpm --filter @little-pieces/api prisma:migrate`

## Coding Style & Naming Conventions
- TypeScript is strict (shared config enables `strict` and `noUncheckedIndexedAccess`).
- Prettier rules: semicolons, single quotes, trailing commas, `printWidth: 100`.
- Use 2-space indentation.
- Use PascalCase for React components and NestJS classes (`HomePage`, `UsersModule`).
- Keep feature folders lowercase (`auth`, `memories`) and use framework file conventions (`page.tsx`, `layout.tsx`, `<domain>.module.ts`).
- Prefer `index.ts` barrel exports at domain/package boundaries.

## Testing Guidelines
There is no dedicated test runner configured yet. Until one is added, treat this as the minimum quality gate:

- `pnpm lint && pnpm typecheck && pnpm build`

When adding tests, colocate them near source files using `*.test.ts(x)` or `*.spec.ts`.

## Commit & Pull Request Guidelines
- Follow Conventional Commits used in history: `chore: ...`, `docs: ...`, `docs(web): ...`.
- Preferred format: `<type>(optional-scope): <imperative summary>`.
- Keep commits focused and small.
- PRs should include: concise summary, linked issue/task, verification commands run, and screenshots for UI changes.

## Security & Configuration Tips
- Do not commit secrets or `.env` files.
- Web env values should start from `apps/web/.env.example`.
- API runtime config should include `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and `PORT`.
