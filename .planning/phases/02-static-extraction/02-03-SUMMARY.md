---
phase: 02-static-extraction
plan: 03
subsystem: extraction-pipeline
tags: [pipeline, convention-registry, stack-detection, deduplication, vitest, ts-morph]

requires:
  - phase: 02-01
    provides: All static extractors (package-json, lockfile, tsconfig, go-mod, cargo-toml, ci, project-structure)
  - phase: 02-02
    provides: Code extractors (naming, imports), runExtractors, ExtractionContext types

provides:
  - extractConventions(projectPath, options?) -> ConventionRegistry (single public entry point)
  - Deduplication logic: category+pattern keyed, higher confidence wins, evidence merged
  - StackInfo population from convention metadata (language, framework, testRunner, packageManager, buildTool)
  - Integration tests proving full pipeline works against real ez-context project
  - Unit tests for package-json extractor and naming extractor

affects:
  - 03-registry-emission (consumes extractConventions output)
  - All downstream phases (pipeline is the primary API consumers will call)

tech-stack:
  added: []
  patterns:
    - "Post-extraction StackInfo population pass (metadata-driven, first-match-wins)"
    - "category+pattern deduplication with evidence merging"
    - "Tests in test/ mirroring src/ directory structure"

key-files:
  created:
    - src/core/pipeline.ts
    - test/core/pipeline.test.ts
    - test/extractors/static/package-json.test.ts
    - test/extractors/code/naming.test.ts
  modified:
    - src/index.ts
    - src/extractors/static/package-json.ts

key-decisions:
  - "TEST_RUNNER_MAP casing updated to proper names (Vitest, Jest, Mocha) to match StackInfo expectations"
  - "buildTool detection reads scriptName==build command first word from convention metadata"
  - "Tests placed in test/ (not src/) to match project's vitest include pattern"

patterns-established:
  - "All extractors are imported by pipeline.ts in confidence-priority order"
  - "StackInfo population is a separate post-extraction pass, not done by individual extractors"
  - "Deduplication: Map<category:pattern, entry>, merge evidence arrays"

duration: ~10min
completed: 2026-02-28
---

# Phase 2 Plan 03: Pipeline and Integration Tests Summary

**`extractConventions(path)` entry point orchestrating 9 extractors with category+pattern deduplication, metadata-driven StackInfo population, and Zod validation -- returning a complete ConventionRegistry in one call**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-28T17:14:00Z
- **Completed:** 2026-02-28T17:25:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `extractConventions()` as the single public API entry point for Phase 2
- Deduplication logic groups by `category:pattern`, keeps higher-confidence entry, merges evidence arrays
- StackInfo population scans convention metadata post-extraction (language, framework, testRunner, packageManager, buildTool)
- Integration test confirms real ez-context project yields `stack.language="TypeScript"`, `stack.packageManager="bun"`, `stack.testRunner="Vitest"` with 52 tests all passing

## Task Commits

1. **Task 1: Pipeline module with StackInfo population and deduplication** - `8029e9b` (feat)
2. **Task 2: Integration tests for extractors and pipeline** - `63a5ee5` (test)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/core/pipeline.ts` - extractConventions() orchestrator: runs all 9 extractors, deduplicates, populates StackInfo, validates
- `src/index.ts` - Updated barrel: added extractConventions, Extractor types, runExtractors exports
- `src/extractors/static/package-json.ts` - Fixed TEST_RUNNER_MAP casing (vitest -> Vitest, jest -> Jest, etc.)
- `test/core/pipeline.test.ts` - Integration test against real project: schema validation, StackInfo, categories, no duplicates
- `test/extractors/static/package-json.test.ts` - Unit test: fixture-based TS/React/Vitest and missing-file detection
- `test/extractors/code/naming.test.ts` - Unit test: camelCase functions and PascalCase classes from fixture

## Decisions Made

- **TEST_RUNNER_MAP casing** - Updated to proper-cased labels (Vitest, Jest, Mocha, Jasmine, Ava) so `stack.testRunner` matches expected formatting without any pipeline-level transformation. Clean at the source.
- **buildTool detection** - Pipeline reads `metadata.scriptName === "build"` from stack conventions and extracts first word of the command. Avoids hardcoding build tool names.
- **Test location** - Tests placed in `test/extractors/` and `test/core/` (not `src/`) to match the vitest config `include: ["test/**/*.test.ts"]` pattern already established in the project.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TEST_RUNNER_MAP produced lowercase test runner names**

- **Found during:** Task 1 review (pipeline StackInfo population)
- **Issue:** Plan required `stack.testRunner === "Vitest"` but the extractor stored `"vitest"` (lowercase). Pipeline would have returned wrong casing.
- **Fix:** Updated TEST_RUNNER_MAP in package-json.ts to use proper names: `vitest -> "Vitest"`, `jest -> "Jest"`, `mocha -> "Mocha"`, `jasmine -> "Jasmine"`, `ava -> "Ava"`
- **Files modified:** src/extractors/static/package-json.ts
- **Verification:** Integration test asserts `result.stack.testRunner === "Vitest"` and passes
- **Committed in:** 8029e9b (Task 1 commit)

**2. [Rule 3 - Blocking] Test file location mismatch with vitest config**

- **Found during:** Task 2 planning
- **Issue:** Plan specified test files at `src/extractors/static/package-json.test.ts` etc., but vitest config uses `include: ["test/**/*.test.ts"]` so tests in `src/` would not be picked up
- **Fix:** Placed all test files in `test/extractors/static/`, `test/extractors/code/`, and `test/core/` mirroring the src/ structure
- **Files modified:** Created in test/ instead of src/
- **Verification:** `bun run test` picks up and runs all 6 test files, 52 tests pass
- **Committed in:** 63a5ee5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking fix)
**Impact on plan:** Both required for correctness. No scope creep.

## Issues Encountered

None - plan executed smoothly after the two deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 is fully complete. All 9 extractors implemented and tested.
- `extractConventions(projectPath)` produces a validated ConventionRegistry ready for emission.
- Phase 3 (registry emission) can directly consume the pipeline output.
- The integration test serves as a regression guard: any breaking change to extraction will surface immediately.

---
*Phase: 02-static-extraction*
*Completed: 2026-02-28*
