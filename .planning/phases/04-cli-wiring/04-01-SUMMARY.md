---
phase: 04-cli-wiring
plan: 01
subsystem: cli
tags: [commander, chalk, ora, cli, bin, tsdown, typescript]

requires:
  - phase: 03-emission-writer
    provides: emit() function, renderClaudeMd, renderAgentsMd, EmitOptions/EmitResult types
  - phase: 02-static-extraction
    provides: extractConventions() pipeline function

provides:
  - Commander.js CLI entry point (src/cli.ts) with generate and inspect subcommands
  - generateAction handler: runs extraction + emission, supports --dry-run, --output, --threshold
  - inspectAction handler: runs extraction + terminal display grouped by category with confidence dots
  - bin field in package.json mapping ez-context -> dist/cli.js
  - Multi-entry tsdown build producing dist/cli.js alongside dist/index.js

affects:
  - 05-semantic-drift (will add drift subcommand to cli.ts)
  - 06-clustering (no CLI impact expected)
  - 07-review-loop (may add --watch flag or review subcommand)
  - 08-polish (npm publish, global install, completion scripts)

tech-stack:
  added: [commander@14.0.3, chalk@5.6.2, ora@9.3.0]
  patterns:
    - Commander.js action-per-file pattern (commands split into src/commands/*.ts)
    - Import directly from submodules in cli.ts (not barrel index.ts) to avoid circular deps
    - ora spinner wrapping async pipeline calls
    - chalk for colored terminal output (green success, red error, yellow warning, cyan headers)

key-files:
  created:
    - src/cli.ts
    - src/commands/generate.ts
    - src/commands/inspect.ts
  modified:
    - package.json (bin field added, commander/chalk/ora in dependencies)
    - tsdown.config.ts (entry extended to include src/cli.ts)
    - bun.lock (updated with new packages)

key-decisions:
  - "Import submodules directly in cli.ts (not barrel) to avoid circular dependency risk"
  - "Commands split into src/commands/ directory one file per command for maintainability"
  - "parseAsync used (not parse) to support top-level await and async action handlers"

patterns-established:
  - "CLI commands in src/commands/{name}.ts exporting {name}Action"
  - "ora spinner start before extractConventions, succeed/fail after"
  - "process.exit(1) on error with chalk.red message"
  - "confidenceDot helper: green >= 0.8, yellow >= 0.6, red < 0.6"

duration: 2min
completed: 2026-02-28
---

# Phase 04 Plan 01: CLI Wiring Summary

**Commander.js CLI with generate (extraction->emission) and inspect (extraction->terminal) subcommands, dist/cli.js shebang entry wired end-to-end**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-28T23:24:38Z
- **Completed:** 2026-02-28T23:26:10Z
- **Tasks:** 2 (both implemented in single atomic commit since command files required for build)
- **Files modified:** 6

## Accomplishments

- `ez-context generate` runs full extraction + emission pipeline, writes CLAUDE.md and AGENTS.md, supports --dry-run preview, --output dir, --threshold, --yes
- `ez-context inspect` displays extracted conventions grouped by category with colored confidence dots (green/yellow/red) and percentage
- `ez-context --help` shows both commands with their options
- Build produces dist/cli.js with shebang preserved, execute permission granted by tsdown

## Task Commits

1. **Task 1+2: CLI entry point + command handlers** - `f9e3ec9` (feat)

**Note:** Both tasks were implemented in a single commit since command handler files (generate.ts, inspect.ts) are imported by cli.ts and must exist for the build to succeed.

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/cli.ts` - CLI entry point: shebang, Commander program, generate + inspect commands, parseAsync
- `src/commands/generate.ts` - generateAction: extraction, emission, dry-run preview, file write output
- `src/commands/inspect.ts` - inspectAction: extraction, grouped category display, confidence colored dots
- `package.json` - Added bin field (ez-context -> dist/cli.js), commander/chalk/ora in dependencies
- `tsdown.config.ts` - Entry extended from ["src/index.ts"] to ["src/index.ts", "src/cli.ts"]
- `bun.lock` - Updated with commander@14.0.3, chalk@5.6.2, ora@9.3.0

## Decisions Made

- **Import directly from submodules in cli.ts** (not barrel index.ts): avoids circular import risk since index.ts re-exports from the same modules that cli.ts would use.
- **Commands split into src/commands/ directory**: one file per command keeps cli.ts minimal and each handler independently testable.
- **parseAsync over parse**: required for top-level await in cli.ts and to support async action handlers without swallowing errors.

## Deviations from Plan

None - plan executed exactly as written. Both tasks were implemented together since they share a build dependency (cli.ts imports command handlers, so both files must exist for the build).

## Issues Encountered

None - dependencies installed cleanly, build succeeded first try, all verifications passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CLI foundation complete and working end-to-end
- `ez-context generate` and `ez-context inspect` both verified against the ez-context project itself
- Phase 5 (semantic drift) can add a `drift` subcommand by creating src/commands/drift.ts and wiring it in src/cli.ts
- Blocker from earlier phases still applies: EzSearchBridge.embed() throws "not supported" -- Phase 5 implementation will need to address this

---
*Phase: 04-cli-wiring*
*Completed: 2026-02-28*
