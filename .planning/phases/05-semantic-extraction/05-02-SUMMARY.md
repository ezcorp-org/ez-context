---
phase: 05-semantic-extraction
plan: 02
subsystem: pipeline
tags: [pipeline, semantic-extractors, architecture, error-handling, vitest, mocking]

# Dependency graph
requires:
  - phase: 05-01
    provides: errorHandlingExtractor and architectureExtractor implementations

provides:
  - semantic extractors wired into ALL_EXTRACTORS in pipeline.ts
  - populateArchitectureInfo post-pass flowing architecture metadata into registry.architecture
  - pipeline integration tests covering semantic extractor behavior and graceful degradation

affects:
  - 06-semantic-drift (uses extractConventions with semantic results)
  - any phase testing end-to-end generate output

# Tech tracking
tech-stack:
  added: []
  patterns:
    - populateArchitectureInfo post-pass (mirrors populateStackInfo, first-match-wins from conventions)
    - vi.mock importOriginal partial mock for modules with both spy targets and re-exported constants
    - call-through spy default (vi.fn(realFn)) allowing per-test overrides without breaking other extractors

key-files:
  created: []
  modified:
    - src/core/pipeline.ts
    - test/core/pipeline.test.ts

key-decisions:
  - "vi.mock importOriginal partial mock: re-export entire real module + wrap listProjectFiles in vi.fn(realFn) so ALWAYS_SKIP is preserved and call-through works by default"
  - "Existing integration test kept in separate describe; beforeEach mocks bridge only, listProjectFiles calls through to real implementation"
  - "Semantic extractor tests in dedicated describe block with listProjectFiles.mockResolvedValue([]) as default"

patterns-established:
  - "Partial module mock pattern: vi.mock with importOriginal, spread actual, override specific exports"
  - "Call-through spy default: vi.fn(realFn) gives test-override capability without breaking real behavior for other tests"

# Metrics
duration: 12min
completed: 2026-02-28
---

# Phase 5 Plan 02: Pipeline Semantic Integration Summary

**Semantic extractors (error-handling + architecture) wired into extractConventions pipeline with populateArchitectureInfo post-pass; registry.architecture.pattern and .layers now populated from convention metadata**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-28T19:11:00Z
- **Completed:** 2026-02-28T19:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `errorHandlingExtractor` and `architectureExtractor` to `ALL_EXTRACTORS` in pipeline.ts
- Added `populateArchitectureInfo` post-pass (mirrors `populateStackInfo`): reads `architecture` conventions and writes `architecturePattern`/`layers` metadata into `registry.architecture`
- Updated `extractConventions` to call `populateArchitectureInfo` after `populateStackInfo` before schema validation
- Added 4 pipeline integration tests in a dedicated `describe("semantic extractor integration")` block, all passing
- Preserved existing real-project integration test with a clean partial-mock pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add semantic extractors to pipeline + populateArchitectureInfo** - `08945d7` (feat)
2. **Task 2: Pipeline integration tests for semantic extractors** - `5092366` (test)

## Files Created/Modified

- `src/core/pipeline.ts` - Added semantic extractor imports, added to ALL_EXTRACTORS, added populateArchitectureInfo function, updated extractConventions pipeline
- `test/core/pipeline.test.ts` - Module-level mocks for bridge + fs, 4 new semantic integration tests, preserved existing integration test via importOriginal partial mock

## Decisions Made

- **importOriginal partial mock pattern for fs.js**: The `project-structure`, `naming`, and `imports` extractors all consume `listProjectFiles` or `ALWAYS_SKIP` from `fs.js`. A bare `vi.mock(() => ({ listProjectFiles: vi.fn() }))` breaks them by omitting `ALWAYS_SKIP`. Solution: `vi.mock(async (importOriginal) => ({ ...actual, listProjectFiles: vi.fn(actual.listProjectFiles) }))` preserves all real exports while wrapping `listProjectFiles` as a controllable spy with call-through as default.

- **Separate describe blocks to avoid mock conflicts**: Existing integration test needs real `listProjectFiles` (for naming/imports extractors to produce results). New semantic tests need controlled `listProjectFiles`. Solved by using a call-through default in the module mock factory so the integration describe works without any override, while the semantic describe explicitly mocks `[]` in `beforeEach`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ALWAYS_SKIP missing from fs.js module mock**
- **Found during:** Task 2 (pipeline integration tests)
- **Issue:** `vi.mock("fs.js", () => ({ listProjectFiles: vi.fn() }))` caused `project-structure` extractor to fail at runtime with "No ALWAYS_SKIP export is defined on the mock" -- the extractor imports `ALWAYS_SKIP` as a constant at module initialization.
- **Fix:** Switched to `importOriginal` pattern that spreads the real module before overriding `listProjectFiles`. This preserves `ALWAYS_SKIP` and any other exports.
- **Files modified:** `test/core/pipeline.test.ts`
- **Verification:** No console.warn from project-structure extractor; all 5 tests pass
- **Committed in:** `5092366` (Task 2 commit)

**2. [Rule 1 - Bug] vi.fn(realFn) type error TS2345**
- **Found during:** Task 2 (typecheck verification)
- **Issue:** `vi.fn((actual as { listProjectFiles: unknown }).listProjectFiles)` fails typecheck because `unknown` is not assignable to `Procedure`.
- **Fix:** Cast via `(actual as any).listProjectFiles` with eslint-disable comment for the specific line.
- **Files modified:** `test/core/pipeline.test.ts`
- **Verification:** `bun run typecheck` passes with no errors
- **Committed in:** `5092366` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs found during testing)
**Impact on plan:** Both fixes were necessary for test infrastructure correctness. No scope creep.

## Issues Encountered

- `vi.fn().mockRestore()` does not restore to a real implementation when the spy was created via `vi.fn()` in a factory (not `vi.spyOn()`). The `importOriginal` + call-through approach is the correct pattern for this use case.

## Next Phase Readiness

- `extractConventions()` now runs all 11 extractors (9 static/code + 2 semantic) in a single `Promise.allSettled` pass
- `registry.architecture.pattern` and `.layers` are populated whenever the architecture extractor detects a pattern
- Pipeline degrades gracefully when no ez-search index exists (semantic extractors return `[]`, static results are unaffected)
- Phase 6 (semantic drift detection) can call `extractConventions()` and receive complete registry with semantic conventions

---
*Phase: 05-semantic-extraction*
*Completed: 2026-02-28*
