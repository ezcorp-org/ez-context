---
phase: 08-additional-formats-integration
plan: "01"
subsystem: emitters
tags: [cursor, copilot, skills, rulesync, ruler, yaml, js-yaml, multi-format]

requires:
  - phase: 03-emission-writer
    provides: "writeWithMarkers, string-builder emitter pattern, EmitOptions/EmitResult types"

provides:
  - "OutputFormat union type covering all 7 AI tool formats"
  - "renderCursorMdc: YAML frontmatter MDC file for Cursor rules"
  - "renderCopilotMd: plain markdown for GitHub Copilot instructions"
  - "renderSkillMd: YAML frontmatter SKILL.md for agent skills platforms"
  - "renderRulesyncMd: YAML frontmatter with targets array for Rulesync distribution"
  - "renderRulerMd: plain markdown for Ruler rule directory"
  - "renderConventionsBody: shared helper eliminating duplication across emitters"
  - "FORMAT_EMITTER_MAP: registry mapping format names to render/filename/strategy"
  - "emit() with formats array and backward-compat defaults"

affects:
  - 08-additional-formats-integration/08-02 (CLI --format flag wiring)

tech-stack:
  added: []
  patterns:
    - "FORMAT_EMITTER_MAP registry: maps OutputFormat to { render, filename, strategy } for dispatch"
    - "render-helpers.ts shared body renderer: renderConventionsBody extracted to prevent duplication across 5 new emitters"
    - "Direct write strategy with mkdir({ recursive: true }) for nested output paths"
    - "Backward compat aliases: claudeMd/agentsMd fields on EmitResult pulled from rendered map"

key-files:
  created:
    - src/emitters/render-helpers.ts
    - src/emitters/cursor-mdc.ts
    - src/emitters/copilot-md.ts
    - src/emitters/skill-md.ts
    - src/emitters/rulesync-md.ts
    - src/emitters/ruler-md.ts
    - test/emitters/emitters-formats.test.ts
  modified:
    - src/emitters/types.ts
    - src/emitters/index.ts
    - test/commands/cli-generate.test.ts

key-decisions:
  - "renderConventionsBody extracted to render-helpers.ts (shared helper, avoids 5x duplication)"
  - "EmitResult keeps claudeMd/agentsMd as aliases from rendered map (backward compat)"
  - "globs: empty string not null/omitted per Cursor pitfall doc (null causes Cursor to reject rule)"
  - "Direct write for cursor/skills/ruler; writeWithMarkers for claude/agents/copilot/rulesync"

patterns-established:
  - "FORMAT_EMITTER_MAP: new formats added by adding one entry, no switch/if chains"
  - "Render function signature: (registry: ConventionRegistry, threshold: number) => string"
  - "Write strategy enum: markers | direct, determined per-format at registration time"

duration: 3min
completed: 2026-03-03
---

# Phase 8 Plan 01: Additional Formats Integration Summary

**Five new emitter modules (cursor-mdc, copilot-md, skill-md, rulesync-md, ruler-md) with FORMAT_EMITTER_MAP dispatch registry, shared renderConventionsBody helper, and 35 new passing tests**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-03T15:53:10Z
- **Completed:** 2026-03-03T15:56:09Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created `renderConventionsBody` shared helper in `render-helpers.ts` to avoid duplication across all 5 new emitters
- Five new render functions with correct format-specific frontmatter (YAML for cursor/skill/rulesync, none for copilot/ruler)
- `FORMAT_EMITTER_MAP` registry enabling O(1) format dispatch with zero if/switch chains
- Extended `EmitResult` with `rendered` map while keeping `claudeMd`/`agentsMd` backward-compat aliases
- 35 new tests covering all renderers, the map registry, and `emit()` dispatch with real filesystem operations

## Task Commits

1. **Task 1: Extend types and create five emitter modules** - `bf5d785` (feat)
2. **Task 2: Update emit() dispatcher and add format tests** - `8c0eb80` (feat)

## Files Created/Modified

- `src/emitters/types.ts` - Added OutputFormat union, formats field on EmitOptions, rendered map on EmitResult
- `src/emitters/render-helpers.ts` - renderConventionsBody shared helper (stack, architecture, conventions, commands sections)
- `src/emitters/cursor-mdc.ts` - renderCursorMdc with YAML frontmatter (description/globs/alwaysApply)
- `src/emitters/copilot-md.ts` - renderCopilotMd plain markdown with HTML comment header
- `src/emitters/skill-md.ts` - renderSkillMd with YAML frontmatter (name: ez-context, description)
- `src/emitters/rulesync-md.ts` - renderRulesyncMd with YAML frontmatter (description, targets list)
- `src/emitters/ruler-md.ts` - renderRulerMd plain markdown with heading
- `src/emitters/index.ts` - FORMAT_EMITTER_MAP registry, refactored emit() with format dispatch
- `test/emitters/emitters-formats.test.ts` - 35 new tests for all formats and emit() dispatch
- `test/commands/cli-generate.test.ts` - Updated makeTestEmitResult fixture to include rendered map

## Decisions Made

- **renderConventionsBody shared helper**: The body rendering pattern was identical across all 5 new emitters. Extracted to `render-helpers.ts` per DRY principle rather than copying 5 times.
- **globs as empty string**: Per research doc pitfall #1, `globs: null` causes Cursor to reject the rule. Using `globs: ""` (empty string) with `alwaysApply: true` is the correct pattern.
- **EmitResult backward compat**: Added `rendered: Record<string, string>` as the primary map, with `claudeMd`/`agentsMd` as derived aliases (`rendered["claude"] ?? ""`). Existing callers that use `result.claudeMd` continue to work without changes.
- **Write strategy per format**: cursor/skills/ruler own their entire file (use `writeFile` with `mkdir recursive`); claude/agents/copilot/rulesync co-exist with user edits (use `writeWithMarkers`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 render functions ready for CLI `--format` flag wiring (Phase 8-02)
- FORMAT_EMITTER_MAP provides clean integration point for CLI dispatch
- `emit()` accepts `formats` array - CLI just needs to parse `--format cursor,copilot` and pass it through
- All tests pass (262/262), build clean, typecheck clean

---
*Phase: 08-additional-formats-integration*
*Completed: 2026-03-03*
