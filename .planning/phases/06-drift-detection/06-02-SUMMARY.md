---
phase: 06-drift-detection
plan: 02
subsystem: drift-detection
tags: [semantic-search, claim-scoring, drift-report, batching, vitest]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Claim type and extractClaims() function from claim-extractor.ts"
  - phase: 05-semantic-extraction
    provides: "EzSearchBridge, SearchResult types and bridge.search() API"

provides:
  - "ClaimStatus type (GREEN | YELLOW | RED) with GREEN_THRESHOLD=0.65, YELLOW_THRESHOLD=0.40"
  - "ScoredClaim type with claim, status, score, evidence fields"
  - "scoreClaims() batched scoring function using bridge.search() in groups of 10"
  - "DriftReport type with sourceFile, healthScore, scoredClaims"
  - "computeHealthScore() returning mean(scores)*100 rounded, 100 for empty"
  - "buildDriftReport() assembling DriftReport with computed health score"
  - "renderDriftReport() producing grouped markdown with evidence for stale/contradicted claims"
  - "31 unit tests covering thresholds, batching, progress callbacks, health math, rendering"

affects:
  - "06-03 (drift orchestrator will call scoreClaims and renderDriftReport)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch processing via local chunk<T>() helper (no lodash dependency)"
    - "String builder pattern (lines.push / join) for markdown rendering"
    - "Mock bridge as plain object with vi.fn() methods (no vi.mock hoisting)"
    - "Progress callback pattern: onProgress?(completed, total) after each batch"

key-files:
  created:
    - src/core/drift/claim-scorer.ts
    - src/core/drift/report.ts
    - test/core/drift/claim-scorer.test.ts
    - test/core/drift/report.test.ts
  modified: []

key-decisions:
  - "chunk<T> helper defined locally in claim-scorer.ts (no lodash) to avoid external dep"
  - "Evidence shown only for YELLOW and RED claims in rendered report (GREEN claims are confirmed)"
  - "Evidence chunk preview truncated to 80 chars with whitespace collapsed"
  - "Status group sections omitted entirely when empty (clean output)"

patterns-established:
  - "Batched async processing: chunk + Promise.all per batch + onProgress callback"
  - "Classification via threshold constants exported for testability"
  - "String builder renderer: lines array pushed then joined with newline"

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 6 Plan 2: Claim Scorer and Drift Report Summary

**Claim scoring via batched bridge.search() with GREEN/YELLOW/RED thresholds, health score as mean(scores)*100, and markdown drift report renderer with evidence for stale/contradicted claims**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-01T00:52:32Z
- **Completed:** 2026-03-01T00:54:22Z
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments

- `scoreClaims()` processes claims in batches of 10 via `Promise.all`, calling `bridge.search(claim.text, { k: 5 })` per claim with a progress callback fired after each batch
- GREEN (>= 0.65) / YELLOW (>= 0.40) / RED (< 0.40) classification with exported threshold constants
- `computeHealthScore()` returns `Math.round(mean(scores) * 100)`, or 100 for zero claims
- `renderDriftReport()` groups claims by status, shows top-2 evidence for non-GREEN claims (truncated to 80 chars), and emits a summary count line

## Task Commits

Each task was committed atomically:

1. **Task 1: Create claim scorer and report modules** - `ccc2959` (feat)
2. **Task 2: Unit tests for scorer and report** - `26c8043` (test)

## Files Created/Modified

- `src/core/drift/claim-scorer.ts` - ClaimStatus type, ScoredClaim type, GREEN/YELLOW/RED_THRESHOLD constants, BATCH_SIZE=10, chunk() helper, scoreClaims() with batching and progress
- `src/core/drift/report.ts` - DriftReport type, computeHealthScore(), buildDriftReport(), renderDriftReport() with grouped markdown output
- `test/core/drift/claim-scorer.test.ts` - 13 tests: threshold boundaries, no-results=RED, 25-claim batching, 3-batch progress callback, evidence preservation, empty input
- `test/core/drift/report.test.ts` - 18 tests: health score math, empty=100, buildDriftReport shape, renderDriftReport header/sections/evidence/summary/truncation/empty

## Decisions Made

- `chunk<T>()` helper defined locally (no lodash) -- keeps the module self-contained with no new dependencies
- Evidence rendered only for YELLOW/RED claims -- GREEN claims are confirmed, no need for supporting evidence in the report
- Empty status groups omitted from rendered output -- cleaner markdown when all claims are GREEN or all are RED

## Deviations from Plan

**1. [Rule 1 - Bug] Removed unused `ScoredClaim` import from claim-scorer.test.ts**

- **Found during:** Task 2 verification (lint)
- **Issue:** `ScoredClaim` was imported as a named type but only used implicitly via `ScoredClaim["status"]` satisfies expression; ESLint flagged it as unused
- **Fix:** Removed the import -- `ClaimStatus` type alone was sufficient for the satisfies checks
- **Files modified:** test/core/drift/claim-scorer.test.ts
- **Verification:** `bun run lint` passes cleanly
- **Committed in:** 26c8043 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused import lint error)
**Impact on plan:** Minor cleanup, no scope creep.

## Issues Encountered

None beyond the lint fix above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scoreClaims()` and `renderDriftReport()` are ready for the 06-03 drift orchestrator
- All 72 drift-detection tests pass (41 claim-extractor + 13 scorer + 18 report)
- No blockers; `EzSearchBridge.embed()` is still a stub but not used by scorer (uses `search()` only)
- Orchestrator (06-03) will need to wire: extractClaims -> scoreClaims -> buildDriftReport -> renderDriftReport

---
*Phase: 06-drift-detection*
*Completed: 2026-03-01*
