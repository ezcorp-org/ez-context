# Roadmap: ez-context

## Overview

ez-context delivers a local-first CLI that extracts coding conventions from codebases and generates AI context files, with semantic drift detection as the core differentiator. The build follows a pipeline-first strategy: schema and types first, then static extraction (instant value, no dependencies), then emission and CLI wiring (working tool by Phase 4), then semantic extraction and drift detection (the differentiator), and finally update logic and format expansion. Each phase adds capability to an already-working tool.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Schema** - Core types, Convention Registry IR, ez-search bridge, project scaffolding
- [x] **Phase 2: Static Extraction** - Package.json, tsconfig, git, CI, and project structure extractors
- [x] **Phase 3: Emission + Writer** - Template engine, marker-aware writer, CLAUDE.md and AGENTS.md emitters
- [x] **Phase 4: CLI Wiring** - Commander.js CLI with generate, inspect, dry-run, progress indicators
- [x] **Phase 5: Semantic Extraction** - Embedding-based convention discovery, architecture recognition, naming analysis
- [x] **Phase 6: Drift Detection** - Claim extraction, vector comparison, drift reports, health scoring
- [x] **Phase 7: Update Command** - Targeted section regeneration combining drift results with marker-based writes
- [x] **Phase 8: Additional Formats + Integration** - Cursor, Copilot, SKILL.md emitters, Rulesync/Ruler export, distribution

## Phase Details

### Phase 1: Foundation + Schema
**Goal**: All components can import shared types and the Convention Registry IR; ez-search is accessible through a clean bridge interface
**Depends on**: Nothing (first phase)
**Requirements**: EXTR-09, EXTR-10, INTG-04
**Success Criteria** (what must be TRUE):
  1. Convention Registry schema is defined and validates sample convention data via zod
  2. ez-search bridge can check for an existing index and trigger indexing when none exists
  3. File traversal respects .gitignore and skips node_modules/dist/generated directories
  4. Project builds, lints, and passes tests with ESM-only TypeScript
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Project scaffolding, build chain, dev tooling
- [x] 01-02-PLAN.md -- Convention Registry schema, ez-search bridge, file utilities

### Phase 2: Static Extraction
**Goal**: Tool can analyze any project's configuration files and produce a populated Convention Registry without requiring ez-search embeddings
**Depends on**: Phase 1
**Requirements**: EXTR-01, EXTR-02, EXTR-03, EXTR-04, EXTR-05, EXTR-08
**Success Criteria** (what must be TRUE):
  1. Running extractors against a real project detects its languages, frameworks, and dependencies
  2. Build/test/lint commands are extracted from package.json scripts and CI configs
  3. Naming conventions and import patterns are detected with frequency counts
  4. Test file patterns (location, naming, framework) are identified
  5. Convention Registry contains all extracted data with confidence scores and evidence references
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Extractor infrastructure + static config extractors (package.json, lockfile, tsconfig, go.mod, Cargo.toml)
- [x] 02-02-PLAN.md -- CI, project structure, naming, and import extractors
- [x] 02-03-PLAN.md -- Pipeline orchestration, StackInfo population, integration tests

### Phase 3: Emission + Writer
**Goal**: Convention Registry data renders into well-structured CLAUDE.md and AGENTS.md files with marker-based sections that support future updates
**Depends on**: Phase 2
**Requirements**: GEN-01, GEN-02, GEN-06, GEN-07
**Success Criteria** (what must be TRUE):
  1. Running the emitter pipeline produces a CLAUDE.md with detected conventions, architecture, and key files
  2. Running the emitter pipeline produces an AGENTS.md following Linux Foundation standard structure
  3. Generated files contain marker pairs (<!-- ez-context:start --> / <!-- ez-context:end -->) around each auto-generated section
  4. Generated output is aggressively minimal -- only conventions agents cannot discover from existing files
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md -- Eta template engine setup, emitter types, marker-aware file writer
- [x] 03-02-PLAN.md -- CLAUDE.md and AGENTS.md renderers with minimal output strategy

### Phase 4: CLI Wiring
**Goal**: Users can run `ez-context generate` and `ez-context inspect` end-to-end, producing context files from any project with clear terminal feedback
**Depends on**: Phase 3
**Requirements**: CLI-01, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08
**Success Criteria** (what must be TRUE):
  1. `ez-context generate` analyzes a project and writes CLAUDE.md and AGENTS.md to disk
  2. `ez-context inspect` displays detected conventions in the terminal
  3. `--dry-run` flag shows what would be generated without writing any files
  4. Progress indicators show analysis status, especially during ez-search indexing
  5. `--yes` flag enables non-interactive mode for CI/scripting
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md -- Commander.js setup, generate and inspect command handlers
- [x] 04-02-PLAN.md -- CLI tests, dry-run refinement, progress indicators, --yes flag

### Phase 5: Semantic Extraction
**Goal**: Tool uses ez-search semantic search to discover conventions that static analysis cannot find -- error handling patterns and architecture shape
**Depends on**: Phase 4
**Requirements**: EXTR-06, EXTR-07
**Success Criteria** (what must be TRUE):
  1. Error handling patterns are discovered by clustering code embeddings and surfaced in the Convention Registry
  2. Architecture patterns (MVC, feature-based, layer-based) are recognized from directory/file semantic clustering
  3. Semantic extractors integrate cleanly with existing static extractors -- `generate` command output includes both
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md -- Error handling and architecture semantic extractors with unit tests
- [x] 05-02-PLAN.md -- Pipeline integration, populateArchitectureInfo, integration tests

### Phase 6: Drift Detection
**Goal**: Users can check whether their existing context files accurately reflect the current codebase, with per-claim evidence and an overall health score
**Depends on**: Phase 5
**Requirements**: DRFT-01, DRFT-02, DRFT-03, DRFT-04, DRFT-05, CLI-02, INTG-03
**Success Criteria** (what must be TRUE):
  1. `ez-context drift` parses existing context files and extracts individual testable claims
  2. Each claim is compared against the code index and rated GREEN (confirmed), YELLOW (possibly stale), or RED (contradicted)
  3. Drift report includes evidence -- which code chunks support or contradict each claim
  4. Overall health score (0-100) summarizes context accuracy
  5. Tool can import and validate existing hand-written context files (CLAUDE.md, .cursorrules)
**Plans**: 3 plans

Plans:
- [x] 06-01-PLAN.md -- Claim extraction types and markdown parser with unit tests
- [x] 06-02-PLAN.md -- Claim scorer (batched bridge.search), health score, drift report renderer
- [x] 06-03-PLAN.md -- CLI drift command, file auto-detection, existing file import

### Phase 7: Update Command
**Goal**: Users can selectively update only the drifted sections of their context files, preserving manual edits
**Depends on**: Phase 6
**Requirements**: UPDT-01, UPDT-02, UPDT-03, UPDT-04, CLI-03
**Success Criteria** (what must be TRUE):
  1. `ez-context update` re-extracts and re-renders only convention sections flagged as drifted
  2. Manual edits outside <!-- ez-context --> markers are preserved after update
  3. Tool validates marker pairs before every write and aborts with a warning on invalid/corrupted markers
  4. Backup of existing file is created before any marker-based update
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md -- Targeted regeneration engine (validateMarkers, backupFile, updateFile) with unit tests
- [x] 07-02-PLAN.md -- Update CLI command, cli.ts wiring, CLI tests

### Phase 8: Additional Formats + Integration
**Goal**: Tool supports all planned output formats and is packaged for distribution via npm and standalone binary
**Depends on**: Phase 7
**Requirements**: GEN-03, GEN-04, GEN-05, GEN-08, INTG-01, INTG-02, DIST-01, DIST-02
**Success Criteria** (what must be TRUE):
  1. `--format cursor` generates .cursor/rules/*.mdc files with YAML frontmatter
  2. `--format copilot` generates .github/copilot-instructions.md
  3. `--format skills` generates SKILL.md modules with progressive disclosure
  4. `--format rulesync` and `--format ruler` export to their respective directories
  5. Tool is installable via `npm install -g @ez-corp/ez-context` and available as a standalone binary
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md -- Five new emitters (cursor, copilot, skills, rulesync, ruler) and format dispatch in emit()
- [x] 08-02-PLAN.md -- --format flag on generate command with validation and tests
- [x] 08-03-PLAN.md -- npm packaging (publishConfig, version, files) and bun compile binary

### Phase 9: Landing Page
**Goal**: A polished, brand-aligned landing page built with SvelteKit + Tailwind CSS deployed on Cloudflare Workers that explains ez-context's value proposition, features, and usage — compelling enough to convert developers into users
**Depends on**: Phase 8 (product must be complete to showcase)
**Requirements**: New (SITE-01 through SITE-05)
**Success Criteria** (what must be TRUE):
  1. Landing page is a SvelteKit app with Tailwind CSS, deployable to Cloudflare Workers
  2. Page follows EZCorp brand guidelines (colors, typography, voice, dark mode)
  3. Page has hero section, features breakdown, code examples, install instructions, and CTA
  4. Fully responsive (mobile, tablet, desktop) with smooth animations
  5. Lighthouse performance score >= 90, accessibility score >= 90
**Plans**: 3 plans

Plans:
- [x] 09-01-PLAN.md -- SvelteKit + Tailwind v4 + Cloudflare scaffolding, brand tokens, fonts, scroll utility
- [x] 09-02-PLAN.md -- All landing page sections (Hero, Problem, Demo, Features, Drift, Formats, Install, FAQ, Footer)
- [x] 09-03-PLAN.md -- SEO meta tags, OpenGraph, favicon, accessibility audit, deployment prep

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Schema | 2/2 | Complete | 2026-02-28 |
| 2. Static Extraction | 3/3 | Complete | 2026-02-28 |
| 3. Emission + Writer | 2/2 | Complete | 2026-02-28 |
| 4. CLI Wiring | 2/2 | Complete | 2026-02-28 |
| 5. Semantic Extraction | 2/2 | Complete | 2026-02-28 |
| 6. Drift Detection | 3/3 | Complete | 2026-02-28 |
| 7. Update Command | 2/2 | Complete | 2026-02-28 |
| 8. Additional Formats + Integration | 3/3 | Complete | 2026-03-03 |
| 9. Landing Page | 3/3 | Complete | 2026-03-03 |

---
*Roadmap created: 2026-02-28*
