---
phase: 05-semantic-extraction
verified: 2026-02-28T19:17:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 5: Semantic Extraction Verification Report

**Phase Goal:** Tool uses ez-search semantic search to discover conventions that static analysis cannot find -- error handling patterns and architecture shape
**Verified:** 2026-02-28T19:17:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Error handling patterns are discovered by clustering code embeddings and surfaced in Convention Registry | VERIFIED | `errorHandlingExtractor` issues 3 search queries, deduplicates by file, emits `category: "error_handling"` entries with confidence and evidence |
| 2 | Architecture patterns (MVC, feature-based, layer-based) are recognized from directory/file semantic clustering | VERIFIED | `architectureExtractor` uses directory scan + optional search confirmation; emits `category: "architecture"` with `metadata.architecturePattern` and `metadata.layers` |
| 3 | Semantic extractors integrate cleanly -- `generate` command output includes both | VERIFIED | Both extractors in `ALL_EXTRACTORS` in `pipeline.ts`; `generate.ts` and `inspect.ts` both call `extractConventions`; emitter renders `error_handling` in Conventions section and architecture info in Architecture section |
| 4 | Both extractors return [] gracefully when no ez-search index exists | VERIFIED | `errorHandlingExtractor`: `hasIndex` check gates all search calls; `architectureExtractor`: uses directory-only mode (confidence 0.7) with no search calls when `hasIndex` is false |
| 5 | Both extractors deduplicate chunks by file path before confidence calculation | VERIFIED | `errorHandlingExtractor`: Map keyed by `result.file`, concatenates chunk text; `architectureExtractor`: `seen` Set on evidence array |
| 6 | `registry.architecture.pattern` and `.layers` are populated from architecture extractor results | VERIFIED | `populateArchitectureInfo` post-pass reads `entry.metadata.architecturePattern` and `entry.metadata.layers`, writes into `registry.architecture`; called in `extractConventions` after `populateStackInfo` |
| 7 | All unit tests and integration tests pass | VERIFIED | 15/15 semantic extractor unit tests pass; 5/5 pipeline integration tests pass (including 4 new semantic integration tests); typecheck and lint clean |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/extractors/semantic/error-handling.ts` | EXTR-06 error handling extractor | VERIFIED | 109 lines; exports `errorHandlingExtractor`; implements `Extractor` interface; no stubs or TODOs |
| `src/extractors/semantic/architecture.ts` | EXTR-07 architecture extractor | VERIFIED | 197 lines; exports `architectureExtractor` + helper functions; dual-signal (directory + search); no stubs or TODOs |
| `test/extractors/semantic/error-handling.test.ts` | Unit tests for error handling extractor | VERIFIED | 184 lines; 7 tests covering all patterns, edge cases, deduplication, confidence cap |
| `test/extractors/semantic/architecture.test.ts` | Unit tests for architecture extractor | VERIFIED | 220 lines; 8 tests covering MVC/feature/layer detection, no-index mode, confidence boost, metadata.layers |
| `src/core/pipeline.ts` | Updated pipeline with semantic extractors + populateArchitectureInfo | VERIFIED | Both extractors in `ALL_EXTRACTORS`; `populateArchitectureInfo` function exists (lines 146-169); called in `extractConventions` after `populateStackInfo` |
| `test/core/pipeline.test.ts` | Pipeline integration tests covering semantic integration | VERIFIED | 4 new tests in `describe("semantic extractor integration", ...)` block; covers error_handling production, registry.architecture population, graceful degradation, schema validation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/extractors/semantic/error-handling.ts` | `src/core/ez-search-bridge.ts` | `createBridge + bridge.search()` | WIRED | `createBridge` imported line 1; `bridge.search()` called 3 times (lines 63-66); `bridge.embed()` never called |
| `src/extractors/semantic/architecture.ts` | `src/core/ez-search-bridge.ts` | `createBridge + bridge.search()` | WIRED | `createBridge` imported line 1; `bridge.search()` called on line 146 when index exists |
| `src/extractors/semantic/architecture.ts` | `src/utils/fs.ts` | `listProjectFiles` | WIRED | `listProjectFiles` imported line 2; called line 108 with extensions array |
| `src/core/pipeline.ts` | `src/extractors/semantic/error-handling.ts` | import + ALL_EXTRACTORS array | WIRED | Import line 15; `errorHandlingExtractor` in ALL_EXTRACTORS line 32 |
| `src/core/pipeline.ts` | `src/extractors/semantic/architecture.ts` | import + ALL_EXTRACTORS array | WIRED | Import line 16; `architectureExtractor` in ALL_EXTRACTORS line 33 |
| `src/core/pipeline.ts` | `registry.architecture` | `populateArchitectureInfo` post-pass | WIRED | `populateArchitectureInfo` defined lines 146-169; called line 204 in `extractConventions` |
| `src/commands/generate.ts` | `src/core/pipeline.ts` | `extractConventions` call | WIRED | Import line 4; `extractConventions(projectPath)` called line 30 |
| `src/emitters/claude-md.ts` | `registry.conventions` (error_handling) | `categoryMap` loop | WIRED | Lines 23-28 group all non-stack/non-architecture conventions by category; `error_handling` entries render as `- **error_handling**: {pattern}` |
| `src/emitters/claude-md.ts` | `registry.architecture` | Architecture section render | WIRED | Lines 92-102 render `registry.architecture.pattern` and `.layers` in "## Architecture" section |

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| EXTR-06: Error handling patterns via semantic embedding clustering | SATISFIED | `errorHandlingExtractor` detects try/catch, Result types, custom error classes, error boundaries via bridge.search(); surfaced in Convention Registry with confidence scores |
| EXTR-07: Architecture patterns via directory/file semantic clustering | SATISFIED | `architectureExtractor` detects MVC/feature-based/layer-based from directory structure (primary) + semantic search (confirmation); populates `registry.architecture.pattern` and `.layers` |

### Anti-Patterns Found

None. No TODO/FIXME/placeholder patterns in any of the 4 new files or 2 modified files. No empty implementations or console.log stubs. No `bridge.embed()` calls in either semantic extractor.

### Human Verification Required

The following items cannot be verified programmatically:

#### 1. End-to-End with Real ez-search Index

**Test:** Run `ez-context generate` against a project that has a real `.ez-search/` index with embedded code.
**Expected:** CLAUDE.md output includes "## Conventions" section with `error_handling` entries and/or "## Architecture" section with detected pattern and layers.
**Why human:** Requires a real ez-search index and a project with identifiable error handling patterns.

#### 2. Architecture Detection on Real Codebase

**Test:** Run `ez-context generate` against a project with clear MVC or feature-based layout (e.g., a Rails app or Next.js app with pages/).
**Expected:** `registry.architecture.pattern` is populated and shows in generated output.
**Why human:** Real filesystem scan + semantic confirmation requires live project.

---

## Summary

Phase 5 goal is fully achieved. All 6 required artifacts exist, are substantive (no stubs), and are correctly wired into the system. All 20 tests (15 unit + 5 integration) pass. Typecheck and lint are clean.

The three success criteria from the roadmap are met:
1. Error handling patterns (try/catch, Result types, custom error classes, error boundaries) are discovered via semantic search and surfaced in the Convention Registry as `category: "error_handling"` entries.
2. Architecture patterns (MVC, feature-based, layer-based) are recognized via directory scan plus optional semantic confirmation; results flow into `registry.architecture.pattern` and `.layers`.
3. Semantic extractors are cleanly wired into the `extractConventions` pipeline alongside all 9 existing static/code extractors; the `generate` command calls `extractConventions` and the emitter renders both `error_handling` conventions and architecture info.

The only items deferred to human verification are live-run checks requiring a real ez-search index, which cannot be verified structurally.

---
_Verified: 2026-02-28T19:17:00Z_
_Verifier: Claude (gsd-verifier)_
