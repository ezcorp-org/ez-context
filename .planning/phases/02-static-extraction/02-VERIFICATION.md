---
phase: 02-static-extraction
verified: 2026-02-28T22:28:28Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 2: Static Extraction Verification Report

**Phase Goal:** Tool can analyze any project's configuration files and produce a populated Convention Registry without requiring ez-search embeddings
**Verified:** 2026-02-28T22:28:28Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running extractors against a real project detects its languages, frameworks, and dependencies | VERIFIED | Integration test asserts `stack.language="TypeScript"`, framework detection in package-json.ts with FRAMEWORK_MAP covering 10 frameworks; test passes |
| 2 | Build/test/lint commands are extracted from package.json scripts and CI configs | VERIFIED | package-json.ts extracts "build"/"test"/"lint" scripts; ci.ts parses GitHub Actions `jobs.*.steps[].run` and GitLab CI `script` arrays, filtering by BUILD/TEST/LINT_KEYWORDS |
| 3 | Naming conventions and import patterns are detected with frequency counts | VERIFIED | naming.ts uses ts-morph AST to count camelCase/PascalCase/snake_case/UPPER_SNAKE_CASE across functions/variables/classes; imports.ts counts relative vs external ratio with barrel and alias detection; confidence scales with sample size |
| 4 | Test file patterns (location, naming, framework) are identified | VERIFIED | project-structure.ts globs 5 patterns (*.test.ts, *.spec.ts, test/, tests/, __tests__/) with count-based confidence; package-json.ts detects test runner framework |
| 5 | Convention Registry contains all extracted data with confidence scores and evidence references | VERIFIED | pipeline.ts runs all 9 extractors, deduplicates by category+pattern, populates StackInfo, validates with ConventionRegistrySchema.parse(); integration test confirms 52 tests pass including schema validation |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/extractors/types.ts` | Extractor interface, ExtractionContext, ExtractorOptions | VERIFIED | 35 lines, exports `Extractor`, `ExtractionContext`, `ExtractorOptions`; substantive type definitions |
| `src/extractors/index.ts` | Parallel extractor runner via Promise.allSettled | VERIFIED | 37 lines, exports `runExtractors`; uses `Promise.allSettled`, accumulates registry with `addConvention`, warns on failure |
| `src/extractors/static/package-json.ts` | JS/TS stack, deps, scripts extraction | VERIFIED | 138 lines, exports `packageJsonExtractor`; detects language (TypeScript/JS), framework (FRAMEWORK_MAP 10 entries), test runner (TEST_RUNNER_MAP 5 entries), scripts |
| `src/extractors/static/lockfile.ts` | Package manager detection | VERIFIED | 47 lines, exports `lockfileExtractor`; checks 5 lockfiles in priority order (bun first) |
| `src/extractors/static/tsconfig.ts` | TypeScript strict mode, compiler options, path aliases | VERIFIED | 112 lines, exports `tsconfigExtractor`; handles non-standard JSON (comment stripping), detects strict mode, compiler options, path aliases |
| `src/extractors/static/go-mod.ts` | Go module detection | VERIFIED | 91 lines, exports `goModExtractor`; line-by-line regex parsing of module, go version, require blocks |
| `src/extractors/static/cargo-toml.ts` | Rust project detection via smol-toml | VERIFIED | 56 lines, exports `cargoTomlExtractor`; uses `smol-toml` parse, extracts package name and dependency count |
| `src/extractors/static/ci.ts` | CI config command extraction | VERIFIED | 171 lines, exports `ciExtractor`; handles GitHub Actions (`jobs.*.steps[].run`) and GitLab CI (`script` arrays), categorizes by BUILD/TEST/LINT keywords |
| `src/extractors/static/project-structure.ts` | Test file pattern detection | VERIFIED | 70 lines, exports `projectStructureExtractor`; globs 5 test patterns with count-based confidence formula `min(0.95, 0.5 + count * 0.05)` |
| `src/extractors/code/naming.ts` | Naming convention detection via ts-morph | VERIFIED | 124 lines, exports `namingExtractor`; classifyCase() function, counts per entity type (functions/variables/classes), minimum 5 identifiers and 0.6 confidence threshold |
| `src/extractors/code/imports.ts` | Import pattern detection via ts-morph | VERIFIED | 150 lines, exports `importsExtractor`; relative/external ratio, barrel file heuristic, path alias detection |
| `src/core/pipeline.ts` | Full extraction pipeline entry point | VERIFIED | 167 lines, exports `extractConventions`; imports all 9 extractors, runs via `runExtractors`, deduplicates by category+pattern, populates StackInfo, validates with Zod schema |
| `src/index.ts` | Updated barrel exports | VERIFIED | Exports `extractConventions`, `Extractor`, `ExtractionContext`, `ExtractorOptions`, `runExtractors` alongside existing exports |
| `test/core/pipeline.test.ts` | Integration test for full pipeline | VERIFIED | 38 lines; asserts schema validity, `stack.language="TypeScript"`, `stack.packageManager="bun"`, `stack.testRunner="Vitest"`, multiple categories, no duplicate category+pattern pairs |
| `test/extractors/static/package-json.test.ts` | Unit test for package-json extractor | VERIFIED | 55 lines; fixture-based test with temp dir, TypeScript/React/Vitest detection and missing-file handling |
| `test/extractors/code/naming.test.ts` | Unit test for naming extractor | VERIFIED | 57 lines; fixture with camelCase functions and PascalCase classes, asserts confidence > 0.6 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/extractors/index.ts` | `src/core/registry.ts` | `import { addConvention }` | WIRED | Line 1: `import { addConvention } from "../core/registry.js"` — called in loop for each fulfilled entry |
| `src/extractors/static/*.ts` (all 7) | `src/extractors/types.ts` | `import type { Extractor, ExtractionContext }` | WIRED | All 7 static extractors import from `../types.js` with `.js` ESM extension |
| `src/extractors/code/*.ts` (both) | `src/extractors/types.ts` | `import type { Extractor, ExtractionContext }` | WIRED | naming.ts and imports.ts both import from `../types.js` |
| `src/core/pipeline.ts` | `src/extractors/index.ts` | `import { runExtractors }` | WIRED | Line 4: `import { runExtractors } from "../extractors/index.js"` — called at line 154 |
| `src/core/pipeline.ts` | `src/core/registry.ts` | `import { createRegistry }` | WIRED | Line 1: `import { createRegistry } from "./registry.js"` — called at line 151 |
| `src/core/pipeline.ts` | All 9 extractors | individual named imports | WIRED | Lines 6-14 import all 9 extractors; all present in `ALL_EXTRACTORS` array at line 20-30 |
| `src/extractors/code/naming.ts` | `src/utils/fs.ts` | `import { listProjectFiles }` | WIRED | Line 2: `import { listProjectFiles } from "../../utils/fs.js"` — called at line 40 |
| `src/extractors/code/imports.ts` | `src/utils/fs.ts` | `import { listProjectFiles }` | WIRED | Line 2: `import { listProjectFiles } from "../../utils/fs.js"` — called at line 47 |
| `src/extractors/code/naming.ts` | `ts-morph` | `import { Project }` | WIRED | Line 1: `import { Project } from "ts-morph"` — used at line 50 to create AST project |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| EXTR-01: Language/framework detection | SATISFIED | package-json.ts detects language (TypeScript/JS) and framework (10 frameworks) |
| EXTR-02: Package manager detection | SATISFIED | lockfile.ts detects bun/pnpm/yarn/npm from lockfile presence |
| EXTR-03: CI command extraction | SATISFIED | ci.ts parses GitHub Actions and GitLab CI YAML |
| EXTR-04: Naming convention detection | SATISFIED | naming.ts with ts-morph AST, frequency counts, confidence scoring |
| EXTR-05: Import pattern detection | SATISFIED | imports.ts with relative/external ratio, barrel files, path aliases |
| EXTR-08: Test file pattern detection | SATISFIED | project-structure.ts + package-json.ts test runner detection |
| Convention Registry with confidence + evidence | SATISFIED | All entries carry confidence scores and evidence refs; schema-validated by Zod |

### Anti-Patterns Found

No blockers or warnings found.

- All `return []` occurrences are legitimate guard clauses (file-not-found, parse error, empty input) — this is the specified "never-throw" contract
- `return null` in ci.ts line 35 is inside `categorizeCommand()` helper — returns null for non-matching commands, not a stub
- No TODO/FIXME/placeholder comments in any extractor file
- No console.log-only implementations
- Build: passes (`bun run build` — 803ms, 4 files output)
- Lint: passes (`bun run lint` — no output, clean)
- Tests: all 52 pass (`bun run test`)

### Human Verification Required

None required. All goal behaviors are verified programmatically:

- Extractor outputs are tested via unit tests with fixture projects
- Integration test runs `extractConventions(".")` against the real ez-context project and asserts `stack.language`, `stack.packageManager`, `stack.testRunner` values
- Schema validation is performed by Zod inside the pipeline and asserted by the test

### Gaps Summary

No gaps found. All 5 must-haves are satisfied:

1. Language/framework/dependency detection works — verified by integration test and package-json unit test
2. Build/test/lint commands extracted — package-json.ts covers scripts, ci.ts covers GitHub Actions and GitLab CI YAML
3. Naming and import patterns with frequency counts — naming.ts classifies identifiers by case type with AST-based counting; imports.ts counts relative/external ratios with barrel and alias detection
4. Test file patterns identified — project-structure.ts detects 5 location patterns; package-json.ts detects test runner framework
5. Convention Registry with confidence scores and evidence references — all entries carry these fields; pipeline validates with Zod schema before returning

---

_Verified: 2026-02-28T22:28:28Z_
_Verifier: Claude (gsd-verifier)_
