---
phase: 05-semantic-extraction
plan: 01
subsystem: extractors
tags: [vitest, ez-search, semantic-search, error-handling, architecture, pattern-detection]

# Dependency graph
requires:
  - phase: 01-foundation-schema
    provides: ConventionEntry schema, Extractor interface
  - phase: 01-02
    provides: EzSearchBridge (createBridge, hasIndex, search)
provides:
  - errorHandlingExtractor (EXTR-06) -- detects try/catch, Result types, custom error classes, error boundaries
  - architectureExtractor (EXTR-07) -- detects MVC, feature-based, layer-based from directory structure + search
affects:
  - 05-02 (populateArchitectureInfo reads metadata.architecturePattern and metadata.layers from architectureExtractor)
  - pipeline (both extractors registered via extractor runner)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.mock factory with vi.fn() only -- no external variable refs to avoid hoisting errors in Vitest ESM"
    - "Merge-then-classify: deduplicate search chunks by file before pattern classification"
    - "Dual-signal architecture: directory scan (deterministic) + semantic search (confirmation)"

key-files:
  created:
    - src/extractors/semantic/error-handling.ts
    - src/extractors/semantic/architecture.ts
    - test/extractors/semantic/error-handling.test.ts
    - test/extractors/semantic/architecture.test.ts
  modified: []

key-decisions:
  - "vi.mock factory must not reference external const variables -- use vi.fn() directly inside factory"
  - "Architecture extractor exports helper functions (extractSourceDirs, detectMVC, etc.) for testability"
  - "Error handling minimum threshold: 2+ distinct files required before emitting a pattern entry"
  - "Architecture confidence: 0.7 directory-only, 0.85 search-confirmed"

patterns-established:
  - "Semantic extractor pattern: createBridge -> hasIndex check -> search queries -> deduplicate by file -> classify -> emit"
  - "Test bridge mock: vi.fn() factory returning mock bridge object with mockBridge.hasIndex/search per test"

# Metrics
duration: 6min
completed: 2026-03-01
---

# Phase 5 Plan 1: Semantic Extraction -- Error Handling + Architecture Summary

**Two semantic extractors using search-then-classify: errorHandlingExtractor detecting 4 error patterns from code chunks, architectureExtractor detecting MVC/feature-based/layer-based from directory structure with optional semantic confirmation**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-01T00:04:05Z
- **Completed:** 2026-03-01T00:10:05Z
- **Tasks:** 2/2
- **Files modified:** 4 (all new)

## Accomplishments

- EXTR-06: Error handling extractor issues 3 targeted search queries, deduplicates by file, classifies 4 patterns (try/catch, Result types, custom error classes, error boundaries), requires 2+ files, confidence capped at 0.95
- EXTR-07: Architecture extractor uses directory scan as primary signal (deterministic), optionally boosts confidence to 0.85 via semantic search, emits `metadata.architecturePattern` and `metadata.layers` for pipeline consumption
- 15 total unit tests (7 + 8) covering all patterns, edge cases, deduplication, and confidence scaling

## Task Commits

Each task was committed atomically:

1. **Task 1: Error handling semantic extractor** - `18d0eb1` (feat)
2. **Task 2: Architecture semantic extractor** - `6e99292` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `src/extractors/semantic/error-handling.ts` - EXTR-06: 4 error patterns, 3 search queries, dedup + confidence scaling
- `src/extractors/semantic/architecture.ts` - EXTR-07: directory scan + optional search confirmation, pattern label + layers
- `test/extractors/semantic/error-handling.test.ts` - 7 unit tests with mocked createBridge
- `test/extractors/semantic/architecture.test.ts` - 8 unit tests with mocked createBridge + listProjectFiles

## Decisions Made

- **vi.mock hoisting:** Factory functions must only use `vi.fn()` inline -- referencing `const` variables declared before `vi.mock` causes "Cannot access before initialization" due to ESM hoisting. Used `vi.mocked(createBridge).mockResolvedValue(bridge)` per-test instead.
- **Architecture helper exports:** Exported `extractSourceDirs`, `detectMVC`, `detectFeatureBased`, `detectLayerBased`, `topLevelDirs` for testability without needing full integration test setup.
- **Error handling minimum:** 2+ distinct files required per pattern to reduce false positives from boilerplate.
- **Architecture dual signal:** Directory scan is deterministic and always runs; search confirmation is optional (adds evidence, boosts confidence). This ensures graceful degradation when no index exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `path` import from architecture.ts**

- **Found during:** Task 2 (lint check)
- **Issue:** `import path from "node:path"` was leftover from initial draft -- never used in final implementation
- **Fix:** Removed the import
- **Files modified:** src/extractors/semantic/architecture.ts
- **Verification:** `bun run lint` passes with no errors
- **Committed in:** 6e99292 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 -- Bug: unused import)
**Impact on plan:** Trivial lint fix only. No scope creep.

## Issues Encountered

- **Vitest ESM hoisting:** Initial test implementation referenced `const mockSearch = vi.fn()` outside the `vi.mock` factory, causing "Cannot access before initialization" at runtime. Fixed by using `vi.fn()` directly inside the factory and accessing mocks via `vi.mocked(createBridge).mockResolvedValue(bridge)` per test. This is consistent with the established project pattern from `test/commands/cli-generate.test.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both extractors (EXTR-06, EXTR-07) are complete and ready for registration in the extractor pipeline
- `metadata.architecturePattern` and `metadata.layers` are emitted by architectureExtractor for Plan 02's `populateArchitectureInfo`
- Both extractors return `[]` gracefully when no ez-search index exists (safe for offline use)
- No blocking concerns for Plan 05-02

---
*Phase: 05-semantic-extraction*
*Completed: 2026-03-01*
