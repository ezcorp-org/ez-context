---
phase: 02-static-extraction
plan: 02
subsystem: extractors
tags: [ts-morph, globby, js-yaml, ast, naming-conventions, import-patterns, ci, github-actions, gitlab-ci]

requires:
  - phase: 02-01
    provides: Extractor interface, ExtractionContext, ALWAYS_SKIP util, listProjectFiles, js-yaml/ts-morph/globby installed

provides:
  - ciExtractor: GitHub Actions + GitLab CI YAML command extraction (build/test/lint)
  - projectStructureExtractor: test file pattern detection with location and count-based confidence
  - namingExtractor: ts-morph AST-based naming convention detection (camelCase, PascalCase, snake_case, UPPER_SNAKE_CASE)
  - importsExtractor: ts-morph AST-based import organization (relative/external ratio, barrel files, path aliases)

affects:
  - 02-03 (extractor integration/index wiring)
  - 03-registry (all extractors must be registered)
  - 06-drift-detection (naming/import patterns used as baseline for drift comparison)

tech-stack:
  added: []
  patterns:
    - "ts-morph Project with skipFileDependencyResolution: true and no tsconfig for portable AST analysis"
    - "classifyCase() pure function for identifier case classification with 4-char minimum length filter"
    - "YAML-based CI parsing with graceful per-file error handling (malformed = skip, not throw)"
    - "globby with ALWAYS_SKIP + gitignore: true for consistent file discovery"
    - "Confidence formula: min(0.95, 0.5 + count * 0.05) for count-based extractors"

key-files:
  created:
    - src/extractors/static/ci.ts
    - src/extractors/static/project-structure.ts
    - src/extractors/code/naming.ts
    - src/extractors/code/imports.ts
  modified: []

key-decisions:
  - "skipFileDependencyResolution: true on ts-morph Project avoids resolveSourceFileDependencies anti-pattern"
  - "ciExtractor stores rawCommands in every matched entry's metadata (not per-file aggregation) for debuggability"
  - "namingExtractor minimum 5 identifiers per entity type before emitting; minimum 0.6 confidence threshold"
  - "isBarrelFile check: has exportDeclarations && no functions/classes/variables"

patterns-established:
  - "Code extractor pattern: listProjectFiles -> slice to maxFilesForAst -> ts-morph Project -> walk source files"
  - "Confidence scaling: count-based (0.5 + n*0.05) vs ratio-based (dominantCount/total)"

duration: ~12min
completed: 2026-02-28
---

# Phase 2 Plan 2: CI, Project Structure, Naming, and Import Extractors Summary

**Four extractors delivering CI command extraction, test pattern detection, AST-based naming conventions (camelCase/PascalCase/snake_case/UPPER_SNAKE_CASE), and import organization (relative ratio, barrel files, path aliases) using ts-morph**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-28T22:17:52Z
- **Completed:** 2026-02-28T22:29:00Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- CI extractor parses GitHub Actions workflows and GitLab CI YAML, filters commands to build/test/lint patterns, confidence 0.9 per matched command
- Project structure extractor finds test files across 5 location patterns (*.test.ts, *.spec.ts, test/, tests/, __tests__/) with count-based confidence
- Naming extractor uses ts-morph AST to count function/variable/class identifier conventions, emits dominant case when >= 5 identifiers and >= 0.6 confidence
- Import extractor uses ts-morph AST to classify relative vs external imports, detect barrel files and path aliases

## Task Commits

1. **Task 1: CI config and project structure extractors** - `14c762f` (feat)
2. **Task 2: Naming convention and import pattern extractors** - `379c3e2` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `src/extractors/static/ci.ts` - ciExtractor: GitHub Actions + GitLab CI YAML command extraction
- `src/extractors/static/project-structure.ts` - projectStructureExtractor: test file pattern/location detection
- `src/extractors/code/naming.ts` - namingExtractor: ts-morph AST identifier case classification
- `src/extractors/code/imports.ts` - importsExtractor: ts-morph AST import organization analysis

## Decisions Made

- Used `skipFileDependencyResolution: true` on ts-morph `Project` to avoid the anti-pattern of calling `resolveSourceFileDependencies()` which causes performance issues on large codebases
- ciExtractor stores `rawCommands` in each matched entry's metadata (not as a separate per-file summary entry) so every convention entry is self-contained for inspection
- namingExtractor requires minimum 5 identifiers per entity type and 0.6 confidence before emitting to avoid noisy low-sample results
- isBarrelFile heuristic: file has export declarations AND no functions/classes/variable declarations

## Deviations from Plan

None - plan executed exactly as written. The `join` import in project-structure.ts was a minor auto-fix (unused import removed per linter).

## Issues Encountered

- Minor: `join` imported but not used in project-structure.ts; removed immediately to pass lint
- Pre-existing test failures in ez-search-bridge.test.ts (3 tests using `vi.mocked`) are unrelated to this plan and were present before execution

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 extractors compile, pass lint, and produce correct output (verified via smoke test against ez-context project)
- Naming extractor detects camelCase functions at 0.95 confidence in the ez-context codebase
- Import extractor correctly identifies mix of relative and external imports
- Ready for 02-03: wiring extractors into the registry index

---
*Phase: 02-static-extraction*
*Completed: 2026-02-28*
