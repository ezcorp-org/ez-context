# Requirements: ez-context

**Defined:** 2026-02-28
**Core Value:** Semantic drift detection -- comparing what context files claim against what code does using local embeddings

## v1 Requirements

Requirements for initial release (v0.1.0 + v0.2.0 scope). Each maps to roadmap phases.

### Convention Extraction

- [x] **EXTR-01**: Tool detects languages and frameworks from project configuration files (package.json, tsconfig, go.mod, Cargo.toml, etc.)
- [x] **EXTR-02**: Tool catalogs project dependencies from lockfiles and manifests
- [x] **EXTR-03**: Tool detects build, test, and lint commands from package.json scripts, Makefile, CI configs
- [x] **EXTR-04**: Tool detects naming conventions (camelCase, PascalCase, kebab-case) via AST analysis with frequency counts
- [x] **EXTR-05**: Tool detects import organization patterns (grouped imports, alias patterns, barrel files)
- [x] **EXTR-06**: Tool detects error handling patterns via semantic embedding clustering
- [x] **EXTR-07**: Tool detects architecture patterns (MVC, feature-based, layer-based) via directory/file semantic clustering
- [x] **EXTR-08**: Tool detects testing patterns (test file location, naming, framework, mock patterns)
- [ ] **EXTR-09**: Tool produces a structured Convention Registry (JSON) containing all detected conventions with confidence scores and evidence references
- [ ] **EXTR-10**: Tool auto-triggers ez-search indexing if no .ez-search/ index exists in the project

### Context File Generation

- [x] **GEN-01**: Tool generates CLAUDE.md with detected conventions, architecture, and key files
- [x] **GEN-02**: Tool generates AGENTS.md following the Linux Foundation universal standard
- [x] **GEN-03**: Tool generates SKILL.md modules with progressive disclosure (focused skill files that load on-demand)
- [x] **GEN-04**: Tool generates .cursor/rules/*.mdc files with YAML frontmatter + Markdown
- [x] **GEN-05**: Tool generates .github/copilot-instructions.md
- [x] **GEN-06**: Generated files use marker-based sections (<!-- ez-context:start --> / <!-- ez-context:end -->) for future updates
- [x] **GEN-07**: Generated output is aggressively minimal -- only conventions agents cannot discover from existing files (informed by research showing bloated context reduces agent performance)
- [x] **GEN-08**: Tool supports --format flag to select output formats (claude, agents, skills, cursor, copilot, rulesync, ruler)

### Drift Detection

- [x] **DRFT-01**: Tool extracts individual testable claims from existing context files
- [x] **DRFT-02**: Tool embeds claims using nomic-embed-text and compares against ez-search code index via cosine similarity
- [x] **DRFT-03**: Tool produces a drift report showing which claims are confirmed, possibly stale, or definitely wrong (GREEN/YELLOW/RED)
- [x] **DRFT-04**: Tool computes a health score (0-100) for overall context accuracy
- [x] **DRFT-05**: Drift report includes evidence -- which code chunks support or contradict each claim

### Incremental Updates

- [x] **UPDT-01**: Tool performs targeted regeneration -- only re-extracts and re-renders drifted convention sections
- [x] **UPDT-02**: Manual edits outside <!-- ez-context --> markers are preserved during updates
- [x] **UPDT-03**: Marker pairs are validated before every write; tool aborts and warns on invalid/corrupted markers
- [x] **UPDT-04**: Tool creates backup of existing file before performing marker-based updates

### CLI

- [x] **CLI-01**: `ez-context generate` -- extract conventions and generate context files
- [x] **CLI-02**: `ez-context drift` -- check context files against code for semantic drift
- [x] **CLI-03**: `ez-context update` -- targeted update of drifted sections only
- [x] **CLI-04**: `ez-context inspect` -- display detected conventions in terminal
- [x] **CLI-05**: `--dry-run` flag previews what would be generated without writing files
- [x] **CLI-06**: Progress indicators during analysis (especially during ez-search indexing)
- [x] **CLI-07**: Non-interactive mode for CI/scripting (--yes flag)
- [x] **CLI-08**: Clear terminal output showing what was generated and where

### Integration

- [x] **INTG-01**: Tool exports to .rulesync/ directory for Rulesync distribution to 24+ tools
- [x] **INTG-02**: Tool exports to .ruler/ directory for Ruler distribution to 30+ agents
- [x] **INTG-03**: Tool can import existing context files (CLAUDE.md, .cursorrules) and enhance/validate them
- [ ] **INTG-04**: Tool respects .gitignore, skips node_modules/dist/generated files automatically

### Distribution

- [x] **DIST-01**: Published as npm package (@ez-corp/ez-context) with global install support
- [x] **DIST-02**: Available as standalone compiled binary (via bun compile)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Watch Mode

- **WATCH-01**: File system watching with debounce for continuous drift monitoring
- **WATCH-02**: Evidence-aware watching -- only re-check conventions whose evidence files changed
- **WATCH-03**: Auto-update context files when drift detected

### Pro Features

- **PRO-01**: Team sync -- shared context configurations across team members
- **PRO-02**: Drift alerts -- scheduled drift detection with Slack/email notifications
- **PRO-03**: CI integration -- GitHub Action for automated drift checks and context updates
- **PRO-04**: Context health dashboard -- track drift scores across repos over time

### Advanced

- **ADV-01**: MCP server mode for dynamic context at query time
- **ADV-02**: Custom template support for proprietary formats
- **ADV-03**: Convention enforcement (linter-style rules derived from detected patterns)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud sync / team governance | Violates 100% local privacy commitment |
| Web dashboard | CLI tool should stay CLI; scope creep |
| IDE plugins (VS Code, JetBrains) | Massive surface area; defer to long term |
| Plugin/marketplace system | Premature ecosystem building |
| 400+ pattern detectors | Diminishing returns; focus on 20-30 high-value patterns |
| Multi-model AI analysis pipeline | Requires API keys; violates local-first positioning |
| Supporting 30+ output formats natively | Maintenance nightmare; Rulesync/Ruler handle the long tail |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXTR-01 | Phase 2 | Complete |
| EXTR-02 | Phase 2 | Complete |
| EXTR-03 | Phase 2 | Complete |
| EXTR-04 | Phase 2 | Complete |
| EXTR-05 | Phase 2 | Complete |
| EXTR-06 | Phase 5 | Complete |
| EXTR-07 | Phase 5 | Complete |
| EXTR-08 | Phase 2 | Complete |
| EXTR-09 | Phase 1 | Complete |
| EXTR-10 | Phase 1 | Complete |
| GEN-01 | Phase 3 | Complete |
| GEN-02 | Phase 3 | Complete |
| GEN-03 | Phase 8 | Complete |
| GEN-04 | Phase 8 | Complete |
| GEN-05 | Phase 8 | Complete |
| GEN-06 | Phase 3 | Complete |
| GEN-07 | Phase 3 | Complete |
| GEN-08 | Phase 8 | Complete |
| DRFT-01 | Phase 6 | Complete |
| DRFT-02 | Phase 6 | Complete |
| DRFT-03 | Phase 6 | Complete |
| DRFT-04 | Phase 6 | Complete |
| DRFT-05 | Phase 6 | Complete |
| UPDT-01 | Phase 7 | Complete |
| UPDT-02 | Phase 7 | Complete |
| UPDT-03 | Phase 7 | Complete |
| UPDT-04 | Phase 7 | Complete |
| CLI-01 | Phase 4 | Complete |
| CLI-02 | Phase 6 | Complete |
| CLI-03 | Phase 7 | Complete |
| CLI-04 | Phase 4 | Complete |
| CLI-05 | Phase 4 | Complete |
| CLI-06 | Phase 4 | Complete |
| CLI-07 | Phase 4 | Complete |
| CLI-08 | Phase 4 | Complete |
| INTG-01 | Phase 8 | Complete |
| INTG-02 | Phase 8 | Complete |
| INTG-03 | Phase 6 | Complete |
| INTG-04 | Phase 1 | Complete |
| DIST-01 | Phase 8 | Complete |
| DIST-02 | Phase 8 | Complete |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after roadmap creation*
