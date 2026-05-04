---
phase: "06"
plan: "03"
name: "drift-cli-wiring"
subsystem: "cli"
tags: ["drift", "cli", "commander", "ora", "chalk", "vitest"]

dependency-graph:
  requires: ["06-01", "06-02"]
  provides: ["driftAction command", "drift CLI registration", "CLI drift tests"]
  affects: []

tech-stack:
  added: []
  patterns: ["command handler pattern (matching generateAction)", "auto-detect candidate files", "per-file claim scoring + report"]

file-tracking:
  key-files:
    created:
      - test/commands/cli-drift.test.ts
    modified:
      - src/commands/drift.ts
      - src/cli.ts

decisions:
  - decision: "PathLike type annotation for existsSync mock"
    rationale: "Node's existsSync accepts PathLike (string | Buffer | URL), not just string; mock implementation must match the overloaded signature"
    phase: "06-03"

metrics:
  duration: "~2 min"
  completed: "2026-02-28"
---

# Phase 6 Plan 3: Drift CLI Wiring Summary

**One-liner:** drift CLI command wiring `driftAction` + auto-detect candidate files + 7 vitest CLI integration tests.

## What Was Built

Task 1 (`src/commands/drift.ts`, `src/cli.ts`) was already committed in `89f7b1c` from a prior session. The files were complete and correct.

Task 2 (`test/commands/cli-drift.test.ts`) was untracked. The test file already existed on disk but needed a type fix before it could pass typecheck.

### src/commands/drift.ts

- `driftAction(pathArg, options)` follows the `generateAction` pattern exactly
- Auto-detects `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `CONTEXT.md` in project root
- `--file` option bypasses auto-detect (supports hand-written context file import -- INTG-03)
- Fails fast with clear error if no index or no files found
- Progress spinner updates during claim scoring via `onProgress` callback
- Health score colored green/yellow/red via chalk thresholds (70/40)

### src/cli.ts

- `drift` subcommand registered with `[path]`, `--file`, `--threshold` options

### test/commands/cli-drift.test.ts

7 tests:
1. No index -> exits with error + spinner.fail
2. No files found -> exits with error + spinner.fail
3. `--file` option -> readFile called with specified path
4. Auto-detect -> CLAUDE.md only -> readFile called with CLAUDE.md
5. Full flow -> renderDriftReport result logged to console
6. Progress callback -> scoreClaims receives onProgress as third argument
7. createBridge error -> spinner.fail + process.exit(1)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PathLike type annotation on existsSync mock**

- **Found during:** Task 2 typecheck
- **Issue:** `mockExistsSync.mockImplementation((p: string) => ...)` rejected by TypeScript because `existsSync` accepts `PathLike` (string | Buffer | URL), not just `string`
- **Fix:** Added `import type { PathLike } from "node:fs"` and changed parameter type to `(p: PathLike) => String(p).endsWith(...)` in two test cases
- **Files modified:** `test/commands/cli-drift.test.ts`
- **Commit:** 8e85caf

## Verification Results

- `bun run typecheck` -- passed (0 errors)
- `bun run test` -- 187 tests passed (16 test files)
- `bun run lint` -- passed (0 warnings)
- `bun run build` -- succeeded (dist/cli.js 13.46 kB)

## Next Phase Readiness

Phase 6 drift detection pipeline is complete:
- 06-01: Claim extractor
- 06-02: Claim scorer + drift report renderer
- 06-03: CLI wiring + tests

The drift command is callable end-to-end: `ez-context drift [path] [--file <file>] [--threshold <n>]`

No blockers for Phase 7.
