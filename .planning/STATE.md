# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** Semantic drift detection -- comparing what context files claim against what code does using local embeddings
**Current focus:** Phase 9 complete -- all 22 plans finished. Project is production-ready.

## Current Position

Phase: 9 of 9 (Landing Page)
Plan: 3 of 3 complete
Status: Phase complete -- ALL PHASES DONE
Last activity: 2026-03-04 -- Completed quick task 001: create docs page

Progress: [███████████████████████] 100% (22/22 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 22
- Average duration: ~5 min
- Total execution time: ~104 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-schema | 2/2 | ~11 min | ~5.5 min |
| 02-static-extraction | 3/3 | ~30 min | ~10 min |
| 03-emission-writer | 2/2 | ~15 min | ~7.5 min |
| 04-cli-wiring | 2/2 | ~4 min | ~2 min |
| 05-semantic-extraction | 2/2 | ~18 min | ~9 min |
| 06-drift-detection | 3/3 | ~6 min | ~2 min |
| 07-update-command | 2/2 | ~10 min | ~5 min |
| 08-additional-formats-integration | 3/3 | ~14 min | ~5 min |
| 09-landing-page | 3/3 | ~25 min | ~8 min |

**Recent Trend:**
- Last 5 plans: 6 min, 12 min, 2 min, 8 min, 3 min
- Trend: fast (packaging/config work requires no complex type solving)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Use bun instead of npm | npm blocked by environment hook (block-npm.sh) | 01-01 |
| tsdown outExtensions forcing .js | Default .mjs output doesn't match package.json exports field | 01-01 |
| vitest passWithNoTests: true | Allows test command to pass with empty test suite in skeleton phases | 01-01 |
| @ez-corp/ez-search v1.3.0 published | No stub needed; real package installs correctly | 01-01 |
| EzSearchBridge.embed() is a stub | @ez-corp/ez-search exposes no standalone embed API; reserved interface for future use | 01-02 |
| Ambient declarations in src/types/ | @ez-corp/ez-search ships no .d.ts; created src/types/ez-search.d.ts for accurate typing | 01-02 |
| ESLint _ prefix pattern | Added argsIgnorePattern/varsIgnorePattern to allow _ prefix for intentional unused params | 01-02 |
| Extractors omit ID field | addConvention auto-assigns UUIDs; extractors return Omit<ConventionEntry, "id">[] | 02-01 |
| Promise.allSettled for extractor runner | One failing extractor must not abort others; faults are warned and skipped | 02-01 |
| Lockfile priority: bun first | bun.lock / bun.lockb checked before pnpm/yarn/npm lockfiles | 02-01 |
| tsconfig non-standard JSON: strip comments | Strip // comments and trailing commas before JSON.parse; avoids heavy JSON5 dep | 02-01 |
| skipFileDependencyResolution on ts-morph | Avoids resolveSourceFileDependencies anti-pattern; portable analysis without tsconfig | 02-02 |
| namingExtractor 5-identifier minimum + 0.6 confidence floor | Prevents noisy low-sample naming results polluting registry | 02-02 |
| isBarrelFile: exportDeclarations && no decls | Heuristic: barrel = only re-exports, no functions/classes/vars | 02-02 |
| TEST_RUNNER_MAP uses proper-cased names | Vitest/Jest/Mocha/etc. so stack.testRunner matches expected formatting without transformation | 02-03 |
| buildTool detection from build script first word | Pipeline reads scriptName==build convention metadata to derive buildTool | 02-03 |
| Tests in test/ not src/ | vitest include pattern is test/**/*.test.ts; src/ tests would not run | 02-03 |
| Single-marker guard in writeWithMarkers | Unpaired marker treated as "no markers" / append to prevent corrupt splicing | 03-01 |
| Placeholder renderers in emit() index.ts | Real renderClaudeMd/renderAgentsMd added in 03-02; keeps emitter compilable now | 03-01 |
| String builder over Eta templates for renderers | Eta control-flow tags leave unwanted blank lines in markdown; lines.push()/join() gives exact whitespace control | 03-02 |
| stack/architecture excluded from Conventions section | Both have dedicated sections; including them would duplicate information | 03-02 |
| Import submodules directly in cli.ts (not barrel) | Avoids circular dependency risk since index.ts re-exports from same modules cli.ts uses | 04-01 |
| Commands split into src/commands/ directory | One file per command keeps cli.ts minimal and each handler independently testable | 04-01 |
| parseAsync used (not parse) | Required for top-level await in cli.ts and async action handlers | 04-01 |
| vi.mock factory hoisting for ora default export | Factory function required; bare vi.mock doesn't work for default exports in ESM | 04-02 |
| process.exit spy type includes null | Node's process.exit accepts null; spy mock must use `number | string | null` for typecheck | 04-02 |
| vi.mock factory: no external const refs | Referencing const variables inside vi.mock factory causes hoisting init errors; use vi.fn() directly and vi.mocked() per test | 05-01 |
| Architecture extractor dual signal | Directory scan is primary (always runs, confidence 0.7); search confirmation optional (boosts to 0.85, adds evidence) | 05-01 |
| Error handling 2-file minimum | Patterns in only 1 file not emitted -- reduces false positives from single-file boilerplate | 05-01 |
| importOriginal partial mock for modules with re-exported constants | When mocking a module that exports both functions (to spy on) and constants (needed by other extractors), use importOriginal to spread real module then override specific exports | 05-02 |
| Call-through spy default: vi.fn(realFn) | Wrapping real function in vi.fn() gives per-test override capability without breaking tests that don't override | 05-02 |
| Bold/code strip before boilerplate filter | **Language:** TypeScript correctly identified as boilerplate after stripping bold markers; order matters | 06-01 |
| chunk<T> helper local in claim-scorer | No lodash dependency; keeps scorer self-contained | 06-02 |
| Evidence rendered for YELLOW/RED only | GREEN claims are confirmed; evidence adds noise without value for supported claims | 06-02 |
| PathLike type annotation for existsSync mock | Node's existsSync accepts PathLike not just string; mock implementation must match the overloaded signature | 06-03 |
| validateMarkers vs writeWithMarkers different contracts | validateMarkers rejects unpaired markers (update pre-flight); writeWithMarkers silently appends (safe initial write) | 07-01 |
| Direct Mock cast instead of vi.mocked | vi.mocked() is undefined in bun's vitest integration; use (fn as unknown as Mock).mockReturnValue() | 07-01 |
| Hardcode marker constants in vi.mock factory | importOriginal is unsupported in bun vitest; MARKER_START/MARKER_END are stable strings, safe to hardcode | 07-01 |
| UPDATE_CANDIDATES: CLAUDE.md + AGENTS.md only | update only ez-context-managed files; .cursorrules/CONTEXT.md are not regenerated by ez-context | 07-02 |
| Dynamic import node:fs/promises in dry-run branch | Simplifies vi.mock hoisting for test isolation in cli-update.test.ts | 07-02 |
| renderConventionsBody shared helper extracted | 5 new emitters share identical body rendering; extracted to render-helpers.ts to avoid duplication | 08-01 |
| FORMAT_EMITTER_MAP registry pattern | Maps OutputFormat to { render, filename, strategy }; adding a new format is one entry, no if/switch chains | 08-01 |
| EmitResult rendered map + backward compat aliases | claudeMd/agentsMd remain as aliases from rendered["claude"/"agents"] so existing callers need no changes | 08-01 |
| globs: empty string not null/omitted in cursor MDC | globs: null causes Cursor to reject rule; globs: "" with alwaysApply: true is the correct pattern | 08-01 |
| Version hardcoded in cli.ts not read from package.json | bun build --compile embeds source at build time; reading package.json at runtime would require bundling as asset | 08-03 |
| parseFormats exported from generate.ts | Enables direct unit testing without going through CLI layer | 08-02 |
| --format default string in cli.ts option definition | Single source of truth; avoids hardcoded fallback in generateAction | 08-02 |
| compile script runs build first then bun build --compile | Ensures dist is fresh before compile embeds source; prevents stale tsdown output | 08-03 |
| SVG favicon in site/ instead of PNG | app.html default PNG ref causes prerender 404; SVG is smaller, scales perfectly, no image pipeline needed | 09-01 |
| site/ is an independent package with own bun.lock | Keeps landing site deps isolated from CLI tool; avoids workspace conflicts | 09-01 |
| Fontsource fonts @import in app.css (not layout.svelte) | Vite processes app.css through @tailwindcss/vite plugin; fonts correctly bundled and referenced | 09-01 |
| CSS animation-delay for terminal line reveals | Prerender-safe; avoids hydration mismatch from JS-driven character-by-character typing animations | 09-02 |
| Native details/summary for FAQ accordions | Zero JS, natively accessible, works without Svelte hydration -- simpler than reactive accordion | 09-02 |
| No og:image/twitter:image meta tags | Referencing nonexistent URL causes 404s in social crawlers; deferred until actual og.png is created | 09-03 |
| Font preload removed from app.html | Vite content hashes change per build; hardcoded woff2 href causes 404; font-display:swap in CSS achieves same non-blocking goal | 09-03 |

### Pending Todos

None yet.

### Blockers/Concerns

- All future plans must use `bun` instead of `npm` for package management
- EzSearchBridge.embed() throws "not supported" -- downstream phases must not call it until implemented

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Create a docs page that explains how to use this and what it does | 2026-03-04 | 1372f9e | [001-create-a-docs-page-that-explains-how-to](./quick/001-create-a-docs-page-that-explains-how-to/) |

## Session Continuity

Last session: 2026-03-04
Stopped at: Completed quick task 001 -- docs page
Resume file: None
