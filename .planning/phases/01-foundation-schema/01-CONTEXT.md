# Phase 1: Foundation + Schema - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Core types, Convention Registry IR, ez-search bridge interface, and project scaffolding. All downstream phases import shared types from here. ez-search is accessible through a clean bridge. File traversal respects .gitignore and standard exclusions.

</domain>

<decisions>
## Implementation Decisions

### ez-search integration
- ez-search is a published npm package: `@ez-corp/ez-search`
- It exposes a JS/TS API (not CLI) — ez-context imports and calls functions directly
- ez-search is a required dependency, always available — no degraded mode needed
- Bridge should be a thin wrapper providing ez-context-specific conveniences (not a heavy abstraction layer)
- Phase 1 bridge needs: check for existing index, trigger indexing, basic search/query

### Claude's Discretion
- Convention Registry schema shape (fields, hierarchy, metadata per convention)
- Project scaffolding choices (build tool, test framework, linting)
- File traversal implementation (symlink handling, depth limits, exclusion patterns)
- Package structure (src layout, barrel exports, module organization)
- Developer experience tooling (watch mode, dev scripts, TypeScript config)

</decisions>

<specifics>
## Specific Ideas

- User wants "the best developer experience" — prioritize fast feedback loops, clear errors, and ergonomic APIs
- ez-search should feel like a first-class part of the app, not a bolted-on dependency

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-schema*
*Context gathered: 2026-02-28*
