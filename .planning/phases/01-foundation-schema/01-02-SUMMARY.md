---
phase: 01-foundation-schema
plan: 02
subsystem: schema
tags: [zod, typescript, ez-search, globby, gitignore, vitest]

requires:
  - phase: 01-01
    provides: ESM TypeScript skeleton with Zod, globby, @ez-corp/ez-search installed

provides:
  - ConventionRegistry IR schemas (Zod v4) with all types inferred via z.infer
  - createRegistry() and addConvention() builder functions
  - EzSearchBridge interface and createBridge() factory (only ez-search consumer)
  - listProjectFiles() gitignore-aware file traversal utility (INTG-04)
  - Ambient TypeScript declarations for @ez-corp/ez-search (no upstream .d.ts files)
  - Full barrel export via src/index.ts

affects:
  - All downstream phases that import ConventionRegistry, EzSearchBridge, or listProjectFiles
  - Phase 02 (analysis) depends on EzSearchBridge.search() and listProjectFiles()
  - Phase 03+ schema consumers depend on ConventionRegistrySchema

tech-stack:
  added: []
  patterns:
    - Zod v4 z.infer<> for all types (no manual TypeScript interfaces for schema types)
    - Bridge pattern isolating @ez-corp/ez-search to a single file
    - Ambient .d.ts declarations for untyped npm packages (src/types/)
    - argsIgnorePattern/varsIgnorePattern for _ prefix convention in ESLint

key-files:
  created:
    - src/core/schema.ts
    - src/core/registry.ts
    - src/core/ez-search-bridge.ts
    - src/utils/fs.ts
    - src/types/ez-search.d.ts
    - test/core/schema.test.ts
    - test/core/ez-search-bridge.test.ts
    - test/utils/fs.test.ts
  modified:
    - src/index.ts
    - eslint.config.js

key-decisions:
  - "EzSearchBridge.embed() is a reserved interface stub -- @ez-corp/ez-search has no standalone embed API"
  - "Ambient type declarations in src/types/ez-search.d.ts rather than skipLibCheck workaround"
  - "ESLint argsIgnorePattern/varsIgnorePattern added to allow _ prefix for intentionally unused params"

patterns-established:
  - "Bridge pattern: only ez-search-bridge.ts may import from @ez-corp/ez-search"
  - "Schema-first: Zod schemas defined at module top-level; types derived via z.infer"
  - "Factory functions validate output via safeParse before returning"

duration: 8min
completed: 2026-02-28
---

# Phase 1 Plan 2: Convention Registry Schema and Core Utilities Summary

**Zod v4 ConventionRegistry IR schemas with z.infer types, ez-search bridge isolating the search dependency, and gitignore-aware file traversal -- 47 tests passing, project builds and lints cleanly.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-28T21:00:00Z
- **Completed:** 2026-02-28T21:08:00Z
- **Tasks:** 2 completed
- **Files modified:** 10

## Accomplishments

- Defined all ConventionRegistry IR schemas in Zod v4 with types fully derived via z.infer (no manual interfaces)
- Implemented EzSearchBridge interface with hasIndex/ensureIndex/search/embed; only file that touches @ez-corp/ez-search
- Implemented listProjectFiles with globby gitignore support (INTG-04), skipping node_modules/dist/generated
- Authored ambient TypeScript declarations for @ez-corp/ez-search (package ships no .d.ts files)
- 47 tests passing across schema, bridge (with mocks), and file traversal

## Task Commits

1. **Task 1: Convention Registry schema and registry builder** - `f0fe406` (feat)
2. **Task 2: ez-search bridge, file traversal, and barrel exports** - `d92844a` (feat)

**Plan metadata:** (to be committed with docs commit)

## Files Created/Modified

- `src/core/schema.ts` - Zod v4 schemas and z.infer types for ConventionRegistry IR
- `src/core/registry.ts` - createRegistry() / addConvention() builder functions
- `src/core/ez-search-bridge.ts` - EzSearchBridge interface and implementation; sole ez-search consumer
- `src/utils/fs.ts` - listProjectFiles() with gitignore support; ALWAYS_SKIP constant
- `src/types/ez-search.d.ts` - Ambient TypeScript declarations for @ez-corp/ez-search
- `src/index.ts` - Barrel exports for all public API
- `test/core/schema.test.ts` - 27 tests: validation, rejection, type inference, registry builder
- `test/core/ez-search-bridge.test.ts` - 9 tests: hasIndex, ensureIndex, search, embed (mocked ez-search)
- `test/utils/fs.test.ts` - 11 tests: listing, skipping, gitignore, additionalIgnore, sorting
- `eslint.config.js` - Added argsIgnorePattern/varsIgnorePattern for _ prefix convention

## Decisions Made

**1. embed() stub instead of not implementing it**
The plan's interface requires embed(). @ez-corp/ez-search exposes only `index`, `query`, `status` at its public API. Implemented embed() as a clearly documented stub that throws an informative error, preserving the interface contract for future implementation.

**2. Ambient declarations in src/types/ez-search.d.ts**
@ez-corp/ez-search v1.3.0 ships no TypeScript declaration files. Rather than using skipLibCheck (which silences all errors) or duplicating types inline, created a typed ambient module declaration that captures the observed API surface accurately.

**3. ESLint _ prefix pattern added to eslint.config.js**
The recommended typescript-eslint config flags `_text` in intentional unused parameters. Added `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"` to allow the standard _ prefix convention across the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @ez-corp/ez-search ships without TypeScript declaration files**

- **Found during:** Task 2 typecheck
- **Issue:** `tsc` reported TS7016 "Could not find a declaration file" for the package
- **Fix:** Created `src/types/ez-search.d.ts` with accurate ambient module declarations matching the observed JS API
- **Files modified:** `src/types/ez-search.d.ts`
- **Commit:** d92844a

**2. [Rule 1 - Bug] ESLint no-unused-vars flagging _ prefix parameters**

- **Found during:** Task 2 lint pass
- **Issue:** `_text` parameter in embed() and other intentional unused params rejected by linter
- **Fix:** Added `argsIgnorePattern`/`varsIgnorePattern` to eslint.config.js; removed unused imports in tests
- **Files modified:** `eslint.config.js`, test files
- **Commit:** d92844a

## Next Phase Readiness

Phase 2 (analysis) can proceed. All foundational types and utilities are available via `import { ... } from "@ez-corp/ez-context"` or direct source imports. Key contracts established:

- `ConventionRegistrySchema` validates registry data
- `EzSearchBridge` provides search access without coupling to ez-search internals
- `listProjectFiles` provides gitignore-aware traversal for any project root
