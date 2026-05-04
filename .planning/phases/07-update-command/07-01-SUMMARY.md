---
phase: 07-update-command
plan: 01
subsystem: core
tags: [updater, drift-detection, marker-validation, file-backup, re-rendering]

# Dependency graph
requires:
  - phase: 06-drift-detection
    provides: extractClaims, scoreClaims, claim types for drift orchestration
  - phase: 03-emission-writer
    provides: writeWithMarkers, MARKER_START, MARKER_END, renderClaudeMd, renderAgentsMd
provides:
  - validateMarkers: pre-flight marker check (append/splice/invalid modes)
  - backupFile: safe .bak copy before write
  - updateFile: full update orchestration (validate -> drift-check -> backup -> re-render -> write)
  - MarkerValidation, FileUpdateResult, UpdateAction types
affects:
  - 07-update-command (Plan 02): CLI update command is thin wrapper over updateFile

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Orchestrator function pattern: validate -> check -> backup -> render -> write"
    - "Pre-flight validation separate from write guard (validateMarkers vs writeWithMarkers silent guard)"
    - "Backup-before-write pattern: .bak file created only when update will proceed"
    - "Emitter selection by basename: agents.md -> renderAgentsMd, others -> renderClaudeMd"

key-files:
  created:
    - src/core/updater.ts
    - test/core/updater.test.ts
  modified: []

key-decisions:
  - "validateMarkers rejects unpaired markers; writeWithMarkers silently appends -- different contracts for different consumers"
  - "Backup created ONLY after validation+drift pass (not on skip or abort)"
  - "Append mode (no markers) always proceeds without drift check -- nothing to compare against"
  - "Empty claims array treated as skip (no drift to detect, nothing to re-render)"
  - "Direct Mock cast pattern instead of vi.mocked -- vi.mocked unavailable in bun's vitest integration"
  - "Hardcode marker constants in vi.mock factory -- importOriginal unsupported in bun vitest"

patterns-established:
  - "Mock cast: (fn as unknown as Mock).mockReturnValue() -- avoids vi.mocked bun incompatibility"
  - "vi.fn() setup in beforeEach, not at describe-body level"

# Metrics
duration: 8min
completed: 2026-02-28
---

# Phase 7 Plan 01: Updater Module Summary

**validateMarkers/backupFile/updateFile engine that orchestrates drift detection with targeted file re-rendering, using pre-flight marker validation and .bak backup before any write**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-01T02:29:37Z
- **Completed:** 2026-03-01T02:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `validateMarkers()` correctly distinguishes append/splice/invalid marker states with detailed reasons
- `backupFile()` safely copies to .bak only when file exists, returns null otherwise
- `updateFile()` orchestrates the full update pipeline: validate -> drift-check -> backup -> re-render -> write, skipping GREEN files and aborting on corrupt markers
- 19 unit tests covering all branches of all three functions, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/core/updater.ts** - `251a7c7` (feat)
2. **Task 2: Create test/core/updater.test.ts** - `e18d2cf` (test)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `src/core/updater.ts` - validateMarkers, backupFile, updateFile with MarkerValidation/FileUpdateResult/UpdateAction types
- `test/core/updater.test.ts` - 19 unit tests: 5 validateMarkers, 2 backupFile, 12 updateFile

## Decisions Made
- `validateMarkers` rejects unpaired markers with descriptive reasons, while `writeWithMarkers` silently appends -- these are different contracts for different consumers (update pre-flight vs initial write)
- Backup is created ONLY after both validation and drift check pass -- no backup on skip or abort
- Append mode (no markers in file) always proceeds to update without drift check -- there is no existing generated section to compare against
- Empty claims array (extractClaims returns []) treated as skip -- nothing to check means nothing to update

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mocked unavailable in bun vitest integration**
- **Found during:** Task 2 (test file creation)
- **Issue:** `vi.mocked()` is undefined at runtime in bun's vitest integration; every existing test file using it also has this issue (pre-existing project-wide problem)
- **Fix:** Used direct cast pattern: `(fn as unknown as Mock).mockReturnValue()` instead of `vi.mocked(fn).mockReturnValue()`
- **Files modified:** test/core/updater.test.ts
- **Verification:** All 19 tests pass with the direct cast approach
- **Committed in:** e18d2cf (Task 2 commit)

**2. [Rule 1 - Bug] importOriginal unsupported in bun vitest**
- **Found during:** Task 2 (test file creation, mock setup)
- **Issue:** `vi.mock(module, async (importOriginal) => {...})` -- `importOriginal` is `undefined` in bun; pipeline.test.ts has the same bug
- **Fix:** Hardcoded `MARKER_START` and `MARKER_END` string literals directly in the vi.mock factory (safe because they are stable constants)
- **Files modified:** test/core/updater.test.ts
- **Verification:** All 19 tests pass
- **Committed in:** e18d2cf (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in test infrastructure patterns)
**Impact on plan:** Both fixes specific to bun vitest incompatibilities. No scope creep. The direct cast pattern is clean and maintainable.

## Issues Encountered
- bun's vitest integration has incomplete `vi` object -- `vi.mocked` and `importOriginal` both missing. This affects many existing tests in the project. The updater tests were written with compatible patterns from the start.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `updateFile()` is ready for Plan 02 CLI wiring -- the `update` command is a thin wrapper
- `validateMarkers` and `backupFile` are exported and independently usable
- No blockers for Plan 02

---
*Phase: 07-update-command*
*Completed: 2026-02-28*
