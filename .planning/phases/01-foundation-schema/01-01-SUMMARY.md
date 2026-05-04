---
phase: 01-foundation-schema
plan: "01"
subsystem: infra
tags: [typescript, esm, tsdown, vitest, eslint, bun, nodejs, zod, globby]

# Dependency graph
requires: []
provides:
  - ESM-only TypeScript project skeleton with NodeNext module resolution
  - tsdown build producing dist/index.js + dist/index.d.ts
  - Vitest test framework configured with passWithNoTests
  - ESLint 9 flat config with typescript-eslint recommended rules
  - Installed runtime deps: zod@4, globby@14, @ez-corp/ez-search@1.3.0
  - src/core/, src/utils/, test/core/, test/utils/ directory structure
affects:
  - 01-foundation-schema plan 02
  - all downstream phases

# Tech tracking
tech-stack:
  added:
    - tsdown@0.20.3 (ESM library bundler, powered by rolldown)
    - vitest@4.0.18 (test runner)
    - eslint@9.39.3 + typescript-eslint@8.56.1 (linting)
    - tsx@4.21.0 (TypeScript execution for dev)
    - zod@4.3.6 (schema validation runtime dep)
    - globby@14.1.0 (glob utility runtime dep)
    - "@ez-corp/ez-search@1.3.0" (semantic search runtime dep)
    - typescript@5.9.3
    - bun@1.3.9 (package manager, npm blocked in this environment)
  patterns:
    - ESM-only with "type:module" and NodeNext moduleResolution
    - tsdown outExtensions forcing .js extension for compatibility with exports field
    - ESLint 9 flat config (not legacy .eslintrc)
    - vitest passWithNoTests for skeleton phase
    - Per-task atomic git commits

key-files:
  created:
    - package.json
    - .gitignore
    - tsconfig.json
    - tsconfig.test.json
    - tsdown.config.ts
    - vitest.config.ts
    - eslint.config.js
    - src/index.ts
    - bun.lock
  modified:
    - .gitignore (pre-existing, added project ignores)

key-decisions:
  - "Use bun instead of npm (npm blocked by environment hook)"
  - "tsdown outExtensions: () => ({ js: '.js', dts: '.d.ts' }) to force .js output matching package.json exports"
  - "vitest passWithNoTests: true to allow test command to pass with empty test suite in skeleton"
  - "eslint --no-error-on-unmatched-pattern to handle empty test/ directory gracefully"
  - "@ez-corp/ez-search was actually published (1.3.0) - no workaround needed"

patterns-established:
  - "ESM-only: all files use .ts imports resolving to .js at runtime (NodeNext)"
  - "Build produces dist/index.js + dist/index.d.ts via tsdown with custom outExtensions"
  - "Lint script uses --no-error-on-unmatched-pattern for resilience against empty dirs"

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 1 Plan 01: Project Scaffold Summary

**ESM-only TypeScript project skeleton with tsdown (rolldown), Vitest, ESLint 9 flat config, and all runtime/dev dependencies installed via bun**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T20:38:37Z
- **Completed:** 2026-02-28T20:41:34Z
- **Tasks:** 2 completed
- **Files modified:** 10

## Accomplishments

- Package.json configured with ESM-only, NodeNext resolution, proper exports field pointing to dist/index.js
- All runtime deps installed: zod@4.3.6, globby@14.1.0, @ez-corp/ez-search@1.3.0
- All dev deps installed: tsdown, vitest, typescript, eslint, typescript-eslint, tsx
- All four validation commands pass: typecheck, build, lint, test

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project and install dependencies** - `c605cbc` (chore)
2. **Task 2: Create TypeScript, build, test, and lint configs** - `cf6322f` (chore)

**Plan metadata:** (docs commit - see below)

## Files Created/Modified

- `package.json` - ESM package with exports, scripts, all dependencies
- `.gitignore` - node_modules, dist, coverage, .ez-search, *.tsbuildinfo
- `bun.lock` - Dependency lockfile (bun is the package manager)
- `tsconfig.json` - NodeNext module/resolution, ES2022 target, strict, declaration output
- `tsconfig.test.json` - Extends tsconfig.json, includes test/, noEmit
- `tsdown.config.ts` - ESM build with node20 target, .js extension override
- `vitest.config.ts` - Node env, test/**/*.test.ts glob, passWithNoTests, v8 coverage
- `eslint.config.js` - ESLint 9 flat config with typescript-eslint recommended
- `src/index.ts` - Placeholder barrel export (`export {}`)
- `test/core/.gitkeep`, `test/utils/.gitkeep` - Directory placeholders

## Decisions Made

- **bun over npm**: npm is blocked by environment hook (`~/.claude/hooks/block-npm.sh`). Bun 1.3.9 used as package manager throughout.
- **tsdown outExtensions**: tsdown with `"type": "module"` defaults to `.mjs`/`.d.mts` output. Added `outExtensions: () => ({ js: '.js', dts: '.d.ts' })` to force `.js` to match the `exports` field in package.json.
- **vitest passWithNoTests**: Added to allow `npm run test` (i.e., `bun run test`) to exit 0 when no test files exist yet. This is the correct behavior for a project skeleton.
- **eslint --no-error-on-unmatched-pattern**: Added to lint script since test/ directory has no .ts files yet; ESLint exits 2 without this flag.
- **@ez-corp/ez-search version**: The package was published (v1.3.0) contrary to the plan's fallback note. Installed normally with `"*"` as version constraint.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm blocked by environment hook - switched to bun**
- **Found during:** Task 1 (Initialize project)
- **Issue:** `npm init -y` blocked by `~/.claude/hooks/block-npm.sh` hook
- **Fix:** Used `bun init -y` then wrote package.json manually with correct fields; used `bun install` throughout
- **Files modified:** package.json (bun.lock created instead of package-lock.json)
- **Verification:** `bun install` succeeds, all scripts run via `bun run`
- **Committed in:** c605cbc (Task 1 commit)

**2. [Rule 1 - Bug] tsdown output extension mismatch**
- **Found during:** Task 2 (Build verification)
- **Issue:** tsdown produced `.mjs`/`.d.mts` files but package.json exports referenced `dist/index.js`/`dist/index.d.ts`
- **Fix:** Added `outExtensions: () => ({ js: '.js', dts: '.d.ts' })` to tsdown.config.ts
- **Files modified:** tsdown.config.ts
- **Verification:** `dist/index.js` and `dist/index.d.ts` now produced
- **Committed in:** cf6322f (Task 2 commit)

**3. [Rule 1 - Bug] vitest exits code 1 with no test files**
- **Found during:** Task 2 (Test verification)
- **Issue:** vitest exits code 1 when no test files found; plan requires `test` to pass trivially
- **Fix:** Added `passWithNoTests: true` to vitest.config.ts
- **Files modified:** vitest.config.ts
- **Verification:** `bun run test` exits 0 with "No test files found, exiting with code 0"
- **Committed in:** cf6322f (Task 2 commit)

**4. [Rule 1 - Bug] eslint exits code 2 with no TS files in test/**
- **Found during:** Task 2 (Lint verification)
- **Issue:** `eslint src/ test/` fails with "No files matching pattern test/" when test/ contains no .ts files
- **Fix:** Added `--no-error-on-unmatched-pattern` flag to lint script
- **Files modified:** package.json (scripts.lint)
- **Verification:** `bun run lint` exits 0
- **Committed in:** cf6322f (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (1 blocking environment issue, 3 bugs)
**Impact on plan:** All fixes necessary for correct operation. No scope creep. The plan assumed npm would be available and that tsdown defaults would match package.json exports.

## Issues Encountered

- tsdown version `^0.10.4` specified in plan doesn't exist; latest stable is 0.20.3. Used `^0.20.0` instead.
- globby version range `^14.1.0` in plan was fine; 14.1.0 is the current version.
- vitest version `^3.2.3` in plan doesn't exist; latest stable is 4.0.18. Used `^4.0.0` instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Project skeleton fully operational; all validation commands pass
- src/core/, src/utils/, test/core/, test/utils/ directories ready for implementation
- Ready for Plan 02: Schema definition (Zod schemas for context files)
- No blockers for Phase 1 Plan 02

---
*Phase: 01-foundation-schema*
*Completed: 2026-02-28*
