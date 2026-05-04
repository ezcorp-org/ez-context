---
phase: 02-static-extraction
plan: 01
subsystem: extraction
tags: [ts-morph, js-yaml, smol-toml, extractors, package-json, lockfile, tsconfig, go-mod, cargo-toml]

requires:
  - phase: 01-foundation-schema
    provides: ConventionEntry, ConventionRegistry, addConvention, createRegistry

provides:
  - Extractor interface and ExtractionContext types in src/extractors/types.ts
  - runExtractors() parallel runner using Promise.allSettled in src/extractors/index.ts
  - packageJsonExtractor: language, framework, test runner, scripts from package.json
  - lockfileExtractor: package manager from lockfile presence
  - tsconfigExtractor: TypeScript strict mode, compiler options, path aliases
  - goModExtractor: Go module name, version, dependency count from go.mod
  - cargoTomlExtractor: Rust package name, dependencies from Cargo.toml

affects:
  - 02-02 (dynamic extractors will implement Extractor interface and use runExtractors)
  - all future extractor phases

tech-stack:
  added:
    - ts-morph@27.0.2 (AST analysis, used in future dynamic extractors)
    - js-yaml@4.1.1 (YAML parsing)
    - smol-toml@1.6.0 (TOML parsing for Cargo.toml)
    - "@types/js-yaml@4.0.9"
  patterns:
    - file-existence guard: try access(), catch return [] (all extractors)
    - never-throw contract: extractors return [] on any parse/IO error
    - Omit<ConventionEntry, "id"> pattern: extractors omit IDs, addConvention assigns UUIDs
    - Promise.allSettled for fault-tolerant parallel extractor execution

key-files:
  created:
    - src/extractors/types.ts
    - src/extractors/index.ts
    - src/extractors/static/package-json.ts
    - src/extractors/static/lockfile.ts
    - src/extractors/static/tsconfig.ts
    - src/extractors/static/go-mod.ts
    - src/extractors/static/cargo-toml.ts
  modified:
    - package.json (added ts-morph, js-yaml, smol-toml, @types/js-yaml)

key-decisions:
  - "Extractors return Omit<ConventionEntry, id>[] so addConvention auto-assigns UUIDs"
  - "Promise.allSettled chosen over Promise.all so one extractor failure does not abort others"
  - "lockfile detection uses priority order: bun.lock > bun.lockb > pnpm-lock.yaml > yarn.lock > package-lock.json"
  - "tsconfig non-standard JSON handled by stripping // comments and trailing commas before JSON.parse"

patterns-established:
  - "Extractor pattern: file-existence guard + parse + never-throw + return entries"
  - "All extractors import from ../types.js with .js extension for ESM compatibility"
  - "Evidence references use { file, line: null } when line-level attribution is unavailable"

duration: 8min
completed: 2026-02-28
---

# Phase 2 Plan 1: Static Extraction Infrastructure Summary

**Extractor interface + fault-tolerant parallel runner + 5 static config-file extractors detecting TypeScript/bun/vitest/Go/Rust stacks from package.json, lockfiles, tsconfig.json, go.mod, and Cargo.toml**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-28T21:10:00Z
- **Completed:** 2026-02-28T21:18:00Z
- **Tasks:** 2
- **Files modified:** 9 (7 created, package.json + bun.lock modified)

## Accomplishments

- Extractor interface and runner infrastructure created -- all future extractors use this foundation
- 5 static config-file extractors implemented and smoke-tested against the ez-context project itself
- Detected TypeScript (language), bun (package manager), vitest (test runner), strict mode on the live project
- go-mod and cargo-toml correctly return empty arrays for non-Go/Rust projects

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create extractor types + runner** - `8e94683` (feat)
2. **Task 2: Implement static config-file extractors** - `a8facb5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/extractors/types.ts` - Extractor interface, ExtractionContext, ExtractorOptions types
- `src/extractors/index.ts` - runExtractors() parallel runner via Promise.allSettled
- `src/extractors/static/package-json.ts` - Language/framework/test-runner/scripts detection
- `src/extractors/static/lockfile.ts` - Package manager detection from lockfile presence
- `src/extractors/static/tsconfig.ts` - TypeScript strict mode, compiler options, path aliases
- `src/extractors/static/go-mod.ts` - Go module name, version, dependency count
- `src/extractors/static/cargo-toml.ts` - Rust package name and dependency count via smol-toml
- `package.json` - Added ts-morph, js-yaml, smol-toml, @types/js-yaml

## Decisions Made

- Extractors return `Omit<ConventionEntry, "id">[]` so `addConvention` auto-assigns UUIDs -- keeps ID generation centralized in registry
- `Promise.allSettled` over `Promise.all` so one broken extractor does not abort the pipeline
- Lockfile detection uses explicit priority order (bun first) to handle projects with multiple lockfiles
- tsconfig non-standard JSON handled by stripping `//` comments and trailing commas before `JSON.parse` (no heavy JSON5 dependency needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Extractor infrastructure complete; dynamic/AST extractors (02-02) can immediately implement the Extractor interface and use runExtractors
- ts-morph is installed and ready for AST analysis in the next plan
- All static extractors vetted against the live project; patterns and confidence values are calibrated

---
*Phase: 02-static-extraction*
*Completed: 2026-02-28*
