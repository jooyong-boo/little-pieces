# Repository Guidelines

## Project Structure & Module Organization
This directory (`apps/web`) is the Next.js frontend app in a pnpm/turborepo monorepo.

- `app/`: App Router routes and layouts (`(public)`, `(private)`, `layout.tsx`, `page.tsx`).
- `src/entities/*`: Core domain models.
- `src/features/*`: User-facing use cases and feature logic.
- `src/widgets`: Higher-level composed UI blocks.
- `src/shared/{api,config,lib,types,ui}`: Reusable cross-cutting modules.
- `src/app/providers`: App-level providers and setup.
- `src/pages-layer/`: Placeholder docs for pages-layer compatibility notes.
- `app/globals.css`: Global styles.

## Build, Test, and Development Commands
Run from `apps/web` unless noted.

- `pnpm dev`: Start Next.js dev server (`PORT` default `3000`).
- `pnpm build`: Create production build.
- `pnpm start`: Run production server.
- `pnpm lint`: Lint `.ts`/`.tsx` files with shared ESLint config.
- `pnpm typecheck`: Run TypeScript checks (`tsc --noEmit`).

From monorepo root, `pnpm dev`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` run via Turbo across apps/packages.

## Coding Style & Naming Conventions
- Language: TypeScript + React (Next.js App Router).
- Formatting follows root Prettier config: semicolons, single quotes, trailing commas, `printWidth: 100`.
- Use 2-space indentation and keep code strict-TS friendly.
- Prefer `@/*` imports for modules under `src/*`.
- Keep layer barrel exports in `index.ts`.
- Component names: PascalCase. Next route files must use framework names (`page.tsx`, `layout.tsx`).
- CSS class names should be descriptive and kebab-case (for example, `map-placeholder`).

## Testing Guidelines
- No dedicated test runner is configured in `apps/web` yet.
- Minimum quality gate before PR: `pnpm lint && pnpm typecheck && pnpm build`.
- When adding tests, colocate them near source as `*.test.ts` or `*.test.tsx`, prioritizing logic-heavy modules in `src/shared` and `src/features`.

## Commit & Pull Request Guidelines
- Use Conventional Commit style (`type: summary`), consistent with current history (for example, `chore: ...`, `docs: ...`).
- Keep commits focused and atomic.
- PRs should include:
  - brief problem/solution summary
  - linked issue/task (if available)
  - validation commands run
  - screenshots for UI-visible changes

## Security & Configuration Tips
- Copy `.env.example` to `.env` and set `NEXT_PUBLIC_API_BASE_URL`.
- Do not commit secrets or environment-specific values.
