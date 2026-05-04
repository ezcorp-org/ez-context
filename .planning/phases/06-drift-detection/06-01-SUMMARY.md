---
phase: 06-drift-detection
plan: 01
subsystem: drift-detection
tags: [claim-extraction, markdown-parsing, regex, drift, typescript]

# Dependency graph
requires:
  - phase: 05-semantic-extraction
    provides: EzSearchBridge interface and search() pattern used by downstream drift plans
provides:
  - Claim interface exported from src/core/drift/claim-extractor.ts
  - extractClaims() function parsing markdown into atomic testable claims
  - 41 unit tests verifying all extraction rules and filters
affects:
  - 06-02 (claim-scorer.ts will import Claim and extractClaims)
  - 06-03 (drift CLI command uses extractClaims on context files)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Line-level regex markdown parsing (no AST, zero-dependency)"
    - "BOILERPLATE_VALUE regex filter applied after bold/code stripping"
    - "1-based line number tracking via loop index + 1"

key-files:
  created:
    - src/core/drift/claim-extractor.ts
    - test/core/drift/claim-extractor.test.ts
  modified: []

key-decisions:
  - "Bold/code stripping happens before boilerplate filter so **Language:** TypeScript is correctly identified as boilerplate"
  - "Both <!-- --> HTML comment check and ez-context: substring check applied (belt-and-suspenders for marker variants)"
  - "H1/H2/H3 headings all tracked for sourceSection (not just H2)"

patterns-established:
  - "Pattern 1: Claim text normalized (stripped) before all filters — ensures consistent filtering regardless of markdown formatting in source"
  - "Pattern 2: Section tracking uses empty string as default (before any heading)"

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 6 Plan 01: Claim Extractor Summary

**Markdown claim extractor using line-level regex: parses bullets/numbered lists into typed Claim objects with section tracking, boilerplate filtering, and bold/code stripping**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T00:48:26Z
- **Completed:** 2026-03-01T00:50:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/core/drift/claim-extractor.ts` exporting `Claim` interface and `extractClaims()` function
- Implemented full extraction pipeline: bullet and numbered list detection, H1/H2/H3 section tracking, bold/code stripping, length filters, boilerplate skip, ez-context marker/HTML comment skip
- 41 unit tests covering all extraction rules, edge cases, and a realistic CLAUDE.md mixed-content integration scenario

## Task Commits

Each task was committed atomically:

1. **Task 1: Create claim extractor module** - `5a0196e` (feat)
2. **Task 2: Unit tests for claim extractor** - `7e3b1af` (test)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/core/drift/claim-extractor.ts` - Claim interface and extractClaims() function with all extraction/filtering logic
- `test/core/drift/claim-extractor.test.ts` - 41 tests across 12 describe blocks

## Decisions Made
- Bold/code stripping applied before boilerplate filter so `**Language:** TypeScript` correctly matches the boilerplate pattern after stripping
- Both `line.startsWith("<!--")` and `line.includes("ez-context:")` checks applied for belt-and-suspenders marker detection
- H1/H2/H3 all tracked for `sourceSection` (research showed H3 headings appear in CLAUDE.md nested sections)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `Claim` interface and `extractClaims()` are ready for import by `06-02` (claim-scorer.ts)
- Import path for downstream: `../../../src/core/drift/claim-extractor.js` (ESM .js extension)
- No blockers for plan 06-02

---
*Phase: 06-drift-detection*
*Completed: 2026-03-01*
