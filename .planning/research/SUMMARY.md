# Project Research Summary

**Project:** ez-context
**Domain:** CLI tool for AI context file generation via semantic codebase analysis
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

ez-context is a local-first CLI that analyzes codebases to generate and maintain AI context files (CLAUDE.md, AGENTS.md, Cursor rules, etc.). The architecture follows a **Collector-Registry-Emitter pipeline**: extractors analyze code (static AST + semantic embeddings via ez-search), feed a typed Convention Registry (the IR), and emitters render that registry into multiple output formats. This pattern is proven by Microsoft's API Extractor and separates concerns cleanly -- adding formats never touches extraction logic.

The recommended stack is ESM-only TypeScript on Node v20.19+, using Commander.js for CLI, Eta for templates, ts-morph for AST analysis, an in-house DBSCAN (~80 lines) plus ml-kmeans for clustering, and chokidar for watch mode. The build chain is tsdown (successor to unmaintained tsup) with tsx for dev. All dependencies have built-in TypeScript types.

The critical risk is **generating context files that make agents worse**. ETH Zurich research shows LLM-generated context files reduce task success by ~3% while increasing cost 20%+. The default output must be aggressively minimal -- only conventions agents cannot discover from existing files. Secondary risks are OOM on large codebases (Drift's v1 crashed, forcing a Rust rewrite), embedding cold-start killing first-run UX, and marker-based updates corrupting user content.

## Key Findings

### Stack Decisions

| Technology | Version | Purpose |
|------------|---------|---------|
| Commander.js | ^14.0.3 | CLI framework (116K dependents, zero-dep) |
| Eta | ^4.5.1 | Template engine (TS-native, 0 deps, no HTML escaping) |
| ts-morph | ^27.x | AST parsing for naming/import conventions |
| In-house DBSCAN | N/A | Convention discovery (~80 lines, cosine distance) |
| ml-kmeans | ^7.0.0 | Cluster refinement when count is known |
| chokidar | ^5.0.0 | File watching (ESM-only, Node v20.19+) |
| globby | ^16.1.1 | Glob + .gitignore parsing |
| gray-matter | ^4.0.3 | YAML frontmatter parsing |
| Vitest | ^4.0.18 | Testing (ESM-native, snapshot support) |
| tsdown | ^0.20.3 | Build/bundle (Rolldown-powered, successor to tsup) |
| zod | ^3.x | Schema validation for convention registry |

**Node.js minimum:** v20.19 (set by chokidar v5 and tsdown).

**Resolved conflict:** ARCHITECTURE.md suggested Handlebars; STACK.md recommends Eta. Eta wins -- Handlebars is unmaintained (3+ years stale), HTML-escapes by default (wrong for markdown), and lacks embedded expressions. Eta is TypeScript-native with zero dependencies.

### Feature Priorities

**v0.1.0 -- Core Generation + Drift (table stakes + primary differentiator):**
- Language/framework/dependency detection (every competitor has this)
- Convention inference via AST + embeddings (the differentiator)
- CLAUDE.md generation (primary audience)
- AGENTS.md generation (emerging cross-tool standard)
- Semantic drift detection (nobody does this well -- core market gap)
- Single-command CLI (`ez-context generate`, `ez-context drift`)
- Dry-run mode, non-interactive mode

**v0.2.0 -- Format Expansion + Watch:**
- SKILL.md generation (unique in market, lazy-loaded context)
- Cursor .mdc output
- Copilot instructions output
- Watch mode (continuous drift detection)
- Import existing context files
- Rulesync/Ruler compatibility (let them handle 30+ tool distribution)

**Defer indefinitely:**
- Cloud sync, team governance, web dashboard
- IDE plugins, plugin/marketplace system
- 400+ pattern detectors (diminishing returns)
- Multi-model AI pipeline (requires API keys, violates local-first)

### Architecture

**Pipeline:** CLI -> Extractors (static + semantic, parallel) -> Convention Registry (IR) -> Emitters (per-format) -> Marker-aware Writer

**Major components and build order:**
1. **Core schema + Registry** -- types and IR that everything depends on
2. **Static extractors** -- package.json, tsconfig, git, CI, project structure (instant, no ez-search needed)
3. **Emitters + writer** -- Eta templates, marker-based file updates, CLAUDE.md + AGENTS.md first
4. **CLI wiring** -- `generate` and `inspect` commands, end-to-end testable
5. **Semantic extractors** -- embedding clusters, architecture recognition, naming analysis (requires ez-search)
6. **Drift engine** -- claim extraction, embedding, vector comparison, reporting
7. **Update command** -- drift + selective re-extraction + marker splice
8. **Additional formats** -- Cursor, Copilot, SKILL.md, Rulesync/Ruler
9. **Watch mode** -- chokidar + evidence-based filtering + debounce

**Key patterns:** Extractors are pure functions returning `ConventionEntry[]`. Registry is an immutable snapshot. Emitters return structured `OutputFile[]` with named sections. Bridge pattern isolates ez-search dependency.

### Critical Risks (Top 5)

1. **CP-1: Generated files that make agents worse** -- Research shows bloated context files reduce agent success. Prevention: default to minimal output (<500 words), bloat scoring, only include conventions agents cannot discover independently. Must be addressed in template design.

2. **CP-3: OOM on real codebases** -- Drift's v1 crashed on large projects, forcing a Rust rewrite. Prevention: stream file processing in batches, never load all vectors at once, test with 1K-10K file codebases from day one.

3. **CP-2: Embedding cold start kills first-run UX** -- 30-120s wait with no feedback. Prevention: run static extractors immediately and show partial results, clear progress indicators, `--fast` mode for static-only.

4. **CP-4: Marker-based updates corrupt user content** -- Markers can be deleted, split, or duplicated. Prevention: validate marker pairs before every write, backup files before update, write-verify cycle, abort on invalid markers.

5. **MP-1: Cosine similarity thresholds are not universal** -- Hardcoded drift thresholds produce false positives/negatives across different projects. Prevention: auto-calibration on first run, relative drift detection (change from baseline), configurable thresholds, `drift --explain`.

## Implications for Roadmap

### Phase 1: Foundation + Schema
**Rationale:** Every component depends on types and the Convention Registry IR.
**Delivers:** `core/schema.ts`, `core/registry.ts`, `core/ez-search-bridge.ts`, `utils/*`
**Research flag:** Standard patterns, no phase research needed.

### Phase 2: Static Extraction
**Rationale:** Works without ez-search, provides immediate value, validates extractor interface.
**Delivers:** All static extractors (package-json, tsconfig, git, CI, project-structure)
**Avoids:** CP-3 (OOM) -- establish streaming/batching patterns here before semantic extraction adds memory pressure.
**Research flag:** Standard patterns.

### Phase 3: Emission + Writer
**Rationale:** Validates the emitter interface with one format before building many. Marker system must be rock-solid (CP-4).
**Delivers:** Eta template engine, marker-aware writer, CLAUDE.md + AGENTS.md emitters
**Avoids:** CP-1 (bloated output) -- template design is where output quality is determined. CP-4 (marker corruption) -- extensive edge case testing here.
**Research flag:** Needs research -- optimal CLAUDE.md structure, AGENTS.md v1.0 spec edge cases.

### Phase 4: CLI Wiring (End-to-End)
**Rationale:** Working tool with static extractors + 2 output formats. Every subsequent phase adds capability to an already-working tool.
**Delivers:** `generate`, `inspect` commands, dry-run mode, progress indicators
**Avoids:** CP-2 (cold start) -- UX layer cannot be an afterthought. Static-first results strategy implemented here.
**Research flag:** Standard patterns.

### Phase 5: Semantic Extraction
**Rationale:** Requires ez-search index. This is where the core differentiator either works or doesn't.
**Delivers:** Clustering-based convention discovery, architecture recognition, naming analysis
**Avoids:** MP-2 (clustering garbage) -- needs careful hyperparameter tuning, quality metrics, trivial pattern filtering.
**Research flag:** NEEDS RESEARCH -- HDBSCAN availability in JS/TS, optimal embedding clustering hyperparameters, convention granularity.

### Phase 6: Drift Detection
**Rationale:** Needs generated context files to exist. Core differentiator (semantic drift).
**Delivers:** Claim extraction, vector comparison, drift reports (GREEN/YELLOW/RED)
**Avoids:** MP-1 (threshold tuning) -- auto-calibration, relative drift. MP-4 (fragile claim extraction) -- start with structured files, add heuristics for free-text.
**Research flag:** NEEDS RESEARCH -- claim extraction techniques, cross-model embedding comparison, calibration approach.

### Phase 7: Update Command
**Rationale:** Combines drift + selective re-extraction + marker splice. Depends on phases 3+6.
**Delivers:** `update` command, targeted section regeneration
**Research flag:** Standard patterns (composition of existing components).

### Phase 8: Additional Formats + Watch
**Rationale:** Broadens reach. Watch mode is pure orchestration on existing components.
**Delivers:** Cursor .mdc, Copilot instructions, SKILL.md, watch mode
**Avoids:** MP-3 (watch infinite loops) -- output exclusion, write-lock, evidence-based watching.
**Research flag:** Standard patterns for formats. Watch mode edge cases are documented in PITFALLS.md.

### Phase Ordering Rationale

- **Schema first** because every component imports these types.
- **Static before semantic** because static extractors are instant, need no dependencies, and validate the pipeline architecture. Ship value before ML works.
- **One emitter before many** because it validates the emitter abstraction. If it works for CLAUDE.md, it works for all formats.
- **CLI wired early (Phase 4)** so end-to-end testing starts early. Every subsequent phase adds to a working tool.
- **Drift after generation** because drift needs context files to compare against.
- **Watch mode last** because it's orchestration on top of everything else.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations backed by npm stats, recent releases, version compatibility verified |
| Features | MEDIUM-HIGH | Competitor analysis covers 8+ tools; AGENTS.md spec still evolving (v1.1 proposal open) |
| Architecture | HIGH | Pipeline pattern proven by API Extractor, Drift, Rulesync; well-documented in sources |
| Pitfalls | HIGH | Critical pitfalls backed by peer-reviewed research (ETH Zurich), production incidents (Drift OOM), documented issues (Gemini CLI, VS Code Copilot) |

**Overall confidence:** HIGH

### Gaps to Address

- **HDBSCAN in JS/TS:** No verified production-quality implementation. May need in-house implementation (~200 lines) or fallback to DBSCAN with adaptive eps. Research during Phase 5 planning.
- **Cross-model embedding comparison:** Drift detection compares claim embeddings against code embeddings. If using different models (nomic for text, jina for code), similarity scores may not be meaningful. Needs prototyping.
- **Convention granularity:** How specific should extracted conventions be? Too broad is useless, too narrow is noise. Needs user testing with real projects.
- **Claim extraction from free-text:** No proven approach for robustly extracting testable claims from hand-written Markdown. Start with structured (generated) files; free-text is a stretch goal.
- **tsdown stability:** Pre-1.0 (v0.20.3). API may change. Mitigated by VoidZero backing and automated tsup migration path. Monitor.

## Sources

### Primary (HIGH confidence)
- ETH Zurich / LogicStar.ai ICML 2025: "Evaluating AGENTS.md" -- context file quality research
- API Extractor Architecture (Microsoft) -- pipeline pattern
- Drift GitHub + Wiki -- production lessons, OOM rewrite
- npm registry -- version/dependency verification for all stack choices

### Secondary (MEDIUM confidence)
- Competitor GitHub repos (Rulesync, Ruler, ClaudeForge, ContextPilot, etc.) -- feature landscape
- Chokidar/globby/ts-morph documentation -- usage patterns
- Cosine similarity academic papers -- threshold sensitivity

### Tertiary (LOW confidence)
- HDBSCAN feasibility in Node.js -- needs validation
- Cross-model embedding comparison -- needs prototyping
- Optimal convention granularity -- needs user testing

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
