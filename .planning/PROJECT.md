# ez-context

## What This Is

A CLI tool that analyzes codebases using ez-search's local semantic embeddings to automatically generate AI context files (CLAUDE.md, AGENTS.md, SKILL.md, .cursor/rules/*.mdc, .github/copilot-instructions.md). It extracts coding conventions, architecture patterns, and project structure — then keeps those files in sync through semantic drift detection that compares what context files claim against what the code actually does. 100% local, no API keys, no cloud calls.

## Core Value

Semantic drift detection — the ability to compare what your context files *claim* against what your code *does* using local embeddings, and surface when they diverge. Everything else (generation, multi-format output) is table stakes; drift detection is the differentiator.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Convention Extraction:**
- [ ] Static extractors: package.json, tsconfig, CI configs, git history
- [ ] Semantic extractors: cluster code embeddings to find repeated patterns
- [ ] Architecture recognition from directory/file semantic clustering
- [ ] Naming convention detection (camelCase, PascalCase, kebab-case frequencies)
- [ ] Stack detection (languages, frameworks, build tools, test runners)
- [ ] Convention Registry: structured JSON output of all detected conventions

**Context File Generation (v0.1.0):**
- [ ] CLAUDE.md generation (hierarchical: global → repo → subdirectory)
- [ ] AGENTS.md generation (Linux Foundation universal standard)

**Context File Generation (v0.2.0):**
- [ ] SKILL.md module generation (progressive disclosure, on-demand loading)
- [ ] .cursor/rules/*.mdc generation (YAML frontmatter + Markdown)
- [ ] .github/copilot-instructions.md generation

**Sync Tool Integration (v0.2.0):**
- [ ] Rulesync export (.rulesync/ directory)
- [ ] Ruler export (.ruler/ directory)

**Drift Detection:**
- [ ] Claim extraction: parse context files into individual testable claims
- [ ] Claim embedding via nomic-embed-text
- [ ] Semantic comparison against ez-search code index
- [ ] Confidence scoring per claim (cosine similarity threshold)
- [ ] Health score (0-100) for overall context accuracy
- [ ] Drift report with evidence (which code chunks contradict which claims)

**Incremental Updates:**
- [ ] Marker-based auto-generated sections (<!-- ez-context:start --> / <!-- ez-context:end -->)
- [ ] Preserve manual edits outside markers
- [ ] Targeted regeneration: only re-extract and re-render drifted conventions
- [ ] Change detection via ez-search's mtime + content hash manifest

**Watch Mode (v0.2.0):**
- [ ] File system watching with debounce
- [ ] Evidence-aware: only re-check conventions whose evidence files changed
- [ ] Auto-update context files when drift detected

**CLI:**
- [ ] `ez-context generate` — extract conventions and generate context files
- [ ] `ez-context drift` — check context files against code for semantic drift
- [ ] `ez-context update` — targeted update of drifted sections only
- [ ] `ez-context inspect` — display detected conventions
- [ ] `ez-context watch` — continuous monitoring and auto-update
- [ ] `--format` flag for selecting output formats (claude, agents, skills, cursor, copilot, rulesync, ruler)
- [ ] Auto-trigger ez-search indexing if no index exists

**Distribution:**
- [ ] npm package (@ez-corp/ez-context) with global install
- [ ] Standalone compiled binary

### Out of Scope

- Pro features (team sync, drift alerts, CI integration, dashboard) — deferred to v0.3.0+
- MCP server mode — deferred to v0.4.0
- Custom template support — deferred to v0.4.0
- IDE extensions — long term
- Convention enforcement (linter-style rules) — long term
- Cross-project convention libraries — long term
- Cloud anything — never for the core tool

## Context

- **ez-search** is a stable Node.js library providing semantic indexing, embedding models (jina-embeddings-v2-base-code for code, nomic-embed-text-v1.5 for text), Zvec vector database, incremental manifests, and WebGPU acceleration. It stores its index in `.ez-search/` per project.
- ez-context is architected as a **query layer on top of ez-search** — roughly 60% reuse of ez-search infrastructure, 40% new code (extractors, templates, drift engine, CLI).
- The market is heating up: Straion raised €1.1M (Feb 2026), Tabnine launched Context Engine (Feb 2026). No local-first semantic solution exists yet.
- AGENTS.md is the emerging universal standard (Linux Foundation, adopted by OpenAI Codex, Google Jules, Cursor, GitHub Copilot).
- Rulesync has 161K weekly npm downloads — huge existing distribution ecosystem we integrate with rather than compete against.

## Constraints

- **Tech stack**: TypeScript ESM, Node.js v20+ (v22+ for WebGPU), Commander.js CLI
- **Dependency**: ez-search must be importable as a Node.js library (not just CLI)
- **Privacy**: Zero network calls, zero telemetry, zero cloud dependencies — this is a hard architectural constraint, not a preference
- **Compatibility**: Must work alongside existing hand-written context files without destroying them (marker-based updates)
- **License**: ISC (open source)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Reuse ez-search index rather than own ML infrastructure | 60% code reuse, zero marginal cost for existing ez-search users, shared model cache | — Pending |
| Auto-trigger ez-search indexing if no index exists | Frictionless first-run experience; user shouldn't need to know about ez-search | — Pending |
| Marker-based updates with always-on markers | Best DX — first generation includes markers so updates work immediately without mode switching | — Pending |
| Integrate with Rulesync/Ruler rather than build own distribution | They already solve multi-format distribution well (833 stars, 161K weekly downloads) | — Pending |
| npm package + standalone binary | npm for ecosystem integration, binary for zero-dependency convenience | — Pending |
| Template engine: implementer's choice | No strong preference — pick what fits best for the output format requirements | — Pending |

---
*Last updated: 2026-02-28 after initialization*
