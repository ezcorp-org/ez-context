# Architecture Patterns

**Domain:** CLI tool for codebase analysis and context file generation
**Researched:** 2026-02-28
**Confidence:** HIGH (well-established patterns from API Extractor, Drift, Rulesync)

## Recommended Architecture

ez-context follows a **Collector-Registry-Emitter pipeline** inspired by Microsoft's API Extractor and the Drift codebase intelligence tool. The central insight: decouple extraction from rendering via a structured intermediate representation (the Convention Registry).

```
                         ez-context Pipeline
  ================================================================

  ┌─────────────┐     ┌──────────────────────────────────────────┐
  │   CLI Layer  │     │            Core Pipeline                 │
  │  (Commander) │────>│                                          │
  │              │     │  ┌────────────┐    ┌──────────────────┐  │
  │  generate    │     │  │ Extractors │    │ Convention       │  │
  │  drift       │     │  │ (Static +  │───>│ Registry (IR)    │  │
  │  update      │     │  │  Semantic) │    │                  │  │
  │  inspect     │     │  └────────────┘    └────────┬─────────┘  │
  │  watch       │     │                             │            │
  └──────────────┘     │                    ┌────────▼─────────┐  │
                       │                    │ Template Engine   │  │
                       │                    │ (Emitters)        │  │
                       │                    └────────┬─────────┘  │
                       │                             │            │
                       │                    ┌────────▼─────────┐  │
                       │                    │ File Writer       │  │
                       │                    │ (Marker-aware)    │  │
                       │                    └──────────────────┘  │
                       └──────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │                    Drift Pipeline                             │
  │                                                              │
  │  Context File ──> Claim Extractor ──> Claim Embedder         │
  │                                           │                  │
  │  ez-search Index <────── Vector Query <───┘                  │
  │                                │                             │
  │                         Drift Report                         │
  └──────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────┐
  │                    ez-search (Dependency)                     │
  │                                                              │
  │  Zvec Vector DB  |  Jina/Nomic Embeddings  |  Manifest       │
  │  .ez-search/     |  WebGPU Inference       |  File Tracking   │
  └──────────────────────────────────────────────────────────────┘
```

### Why This Architecture

**Lessons from API Extractor (Microsoft):** Their pipeline separates Analyzer (AST traversal) from Collector (intermediate inventory) from Generators (output formats). This decoupling means adding a new output format never touches extraction logic, and adding a new extractor never touches output logic. ez-context needs the same -- we have 7+ output formats and will add more.

**Lessons from Drift (dadbodgeoff):** Drift's pattern detection pipeline uses a layered parsing approach: Tree-sitter AST as primary parser, regex fallback as secondary, then a hybrid merger with confidence scores. ez-context should follow the same pattern: static extractors (high confidence, fast) combined with semantic extractors (ML-based, broader but noisier), merged with confidence scoring.

**Lessons from Rulesync:** Rulesync solves the same multi-format output problem. Its architecture uses feature processors that each implement the same lifecycle: load unified source, transform to tool format, write output. The key insight: a unified canonical representation (their `.rulesync/` directory) decouples source from target. Our Convention Registry serves the same role.

---

## Component Boundaries

### Layer 1: CLI (Command Router)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `cli/index.ts` | Entry point, Commander.js setup | Command handlers |
| `cli/commands/generate.ts` | Orchestrate generate flow | Pipeline orchestrator |
| `cli/commands/drift.ts` | Orchestrate drift check | Drift engine |
| `cli/commands/update.ts` | Orchestrate targeted update | Drift engine + Pipeline |
| `cli/commands/inspect.ts` | Display conventions | Convention Registry |
| `cli/commands/watch.ts` | Start watcher | Watch orchestrator |

**Boundary rule:** CLI commands are thin wrappers. They parse arguments, call the orchestrator, format output. Zero business logic. This enables programmatic use (import as library) without the CLI.

### Layer 2: Pipeline Orchestrator

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `core/pipeline.ts` | Sequence extractors, build registry, run emitters | Extractors, Registry, Emitters |
| `core/registry.ts` | Convention Registry: the IR between extraction and emission | Extractors write, Emitters read |
| `core/ez-search-bridge.ts` | Adapter to ez-search API (index, search, embed) | ez-search library |

**Boundary rule:** The pipeline orchestrator is the only component that knows the full flow. Extractors don't know about emitters. Emitters don't know about extractors. The Registry is the contract between them.

### Layer 3: Extractors (Analysis)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `extractors/static/package-json.ts` | Parse dependencies, scripts, engines | Filesystem |
| `extractors/static/tsconfig.ts` | Parse TS compiler options, strictness | Filesystem |
| `extractors/static/git.ts` | Branch conventions, commit patterns | Git CLI / filesystem |
| `extractors/static/ci.ts` | CI/CD pipeline detection | Filesystem |
| `extractors/static/project-structure.ts` | Directory layout, file patterns | Filesystem |
| `extractors/semantic/clustering.ts` | Cluster code embeddings to find patterns | ez-search bridge |
| `extractors/semantic/architecture.ts` | Recognize architectural layers | ez-search bridge |
| `extractors/semantic/naming.ts` | Naming convention frequency analysis | AST / filesystem |

**Boundary rule:** Each extractor is a pure function: `(projectPath, options) => ConventionEntry[]`. Extractors have no knowledge of each other. They can run in parallel. Each returns zero or more typed convention entries with confidence scores.

**Extractor interface:**

```typescript
interface Extractor {
  name: string;
  type: 'static' | 'semantic';
  extract(ctx: ExtractionContext): Promise<ConventionEntry[]>;
}

interface ExtractionContext {
  projectPath: string;
  ezSearch: EzSearchBridge;    // for semantic extractors
  manifest: FileManifest;      // from ez-search
  options: ExtractorOptions;
}

interface ConventionEntry {
  category: ConventionCategory;  // 'stack' | 'naming' | 'architecture' | 'error_handling' | ...
  pattern: string;               // human-readable description
  confidence: number;            // 0-1
  evidence: EvidenceRef[];       // file:line references
  metadata?: Record<string, unknown>;
}
```

### Layer 4: Convention Registry (IR)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `core/registry.ts` | Aggregate, deduplicate, rank conventions | Extractors (input), Emitters (output) |
| `core/schema.ts` | TypeScript types + JSON schema for registry | Everything |

**The Registry is the central data structure.** It's the intermediate representation that decouples extraction from emission. Inspired by API Extractor's `Collector` and compiler IR design.

```typescript
interface ConventionRegistry {
  version: string;
  projectPath: string;
  generatedAt: string;
  stack: StackInfo;
  conventions: ConventionEntry[];
  architecture: ArchitectureInfo;
  metadata: RegistryMetadata;
}
```

**Boundary rule:** The Registry is serializable to JSON. It can be cached to disk (`.ez-context/registry.json`). This enables: (1) `inspect` reads cached registry without re-extracting, (2) `update` diffs new extraction against cached registry, (3) debugging by examining the JSON.

### Layer 5: Emitters (Output Generation)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `emitters/engine.ts` | Template rendering orchestrator | Registry, format-specific emitters |
| `emitters/formats/claude.ts` | CLAUDE.md format logic | Template engine |
| `emitters/formats/agents.ts` | AGENTS.md format logic | Template engine |
| `emitters/formats/cursor.ts` | .cursor/rules/*.mdc format logic | Template engine |
| `emitters/formats/copilot.ts` | copilot-instructions.md format logic | Template engine |
| `emitters/formats/skills.ts` | SKILL.md format logic | Template engine |
| `emitters/formats/rulesync.ts` | .rulesync/ directory format | Template engine |
| `emitters/formats/ruler.ts` | .ruler/ directory format | Template engine |
| `emitters/writer.ts` | Marker-aware file writer | Filesystem |

**Boundary rule:** Each emitter implements the same interface: `(registry: ConventionRegistry) => OutputFile[]`. An `OutputFile` contains path, content, and marker metadata. The writer handles the actual disk I/O with marker-based splicing.

**Emitter interface:**

```typescript
interface Emitter {
  format: OutputFormat;
  emit(registry: ConventionRegistry): OutputFile[];
}

interface OutputFile {
  relativePath: string;
  content: string;
  sections: MarkedSection[];  // for marker-based updates
}

interface MarkedSection {
  id: string;                  // e.g., 'framework', 'naming', 'architecture'
  content: string;
  conventionRefs: string[];    // which conventions this section represents
}
```

### Layer 6: Drift Engine

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `drift/claim-extractor.ts` | Parse context files into testable claims | Filesystem |
| `drift/claim-embedder.ts` | Embed claims via nomic-embed-text | ez-search bridge |
| `drift/comparator.ts` | Vector similarity between claims and code index | ez-search bridge |
| `drift/reporter.ts` | Generate drift reports with scores | Comparator output |

**Boundary rule:** The drift engine is fully independent from the generation pipeline. It reads context files (any source, not just ez-context-generated ones) and the ez-search index. This means it can check hand-written CLAUDE.md files too.

### Layer 7: Watch Orchestrator

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `watch/watcher.ts` | Chokidar file watching with debounce | Filesystem |
| `watch/evidence-filter.ts` | Map changed files to affected conventions | Registry |
| `watch/orchestrator.ts` | Coordinate selective re-extraction + update | Pipeline, Drift engine |

**Boundary rule:** Watch mode is purely an orchestration layer. It decides *when* to re-run parts of the pipeline. It never contains extraction or emission logic itself.

### Layer 8: Marker-Based File Writer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `emitters/writer.ts` | Read existing file, splice marked sections, preserve manual edits | Filesystem |

**Marker format:**

```markdown
<!-- ez-context:start:framework -->
Auto-generated content here
<!-- ez-context:end:framework -->

Manual content here is never touched.

<!-- ez-context:start:naming -->
More auto-generated content
<!-- ez-context:end:naming -->
```

**Pattern source:** EntityFrameworkCore.Generator uses the same region-based approach -- `#region Generated Properties` markers that allow regeneration of marked sections while preserving everything else. This is the standard pattern for tools that generate into files users also edit.

---

## Data Flow

### Generate Flow

```
1. CLI parses args (format, output path, options)
         │
2. Pipeline checks for ez-search index
         │
    ┌─────┴──────┐
    │ Index       │ No index found?
    │ exists?     ├──────> Auto-trigger ez-search indexing
    └─────┬──────┘         │
          │<───────────────┘
3. Pipeline loads manifest from ez-search
         │
4. Pipeline runs all extractors in parallel
         │
    ┌─────┴──────────────────────────┐
    │                                │
    Static Extractors          Semantic Extractors
    (package.json, tsconfig,   (embedding clusters,
     git, CI, structure)        architecture, naming)
    │                                │
    └─────────┬──────────────────────┘
              │
5. Convention Registry aggregated
   - Deduplicate overlapping conventions
   - Resolve conflicts (higher confidence wins)
   - Assign categories
              │
6. Registry cached to .ez-context/registry.json
              │
7. Selected emitters render registry to OutputFiles
              │
8. Writer writes files with markers
   - New file: write full content with markers
   - Existing file: splice only marked sections
```

### Drift Flow

```
1. CLI parses args (which context files to check)
         │
2. Claim Extractor parses context file
   - Sentence-level splitting
   - Filter noise (headings, boilerplate)
   - Each claim: "Uses Hono framework", "Vitest for testing"
         │
3. Claim Embedder: embed each claim string
   via ez-search bridge (nomic-embed-text)
         │
4. Comparator: for each claim embedding,
   query ez-search index (top-k=10)
         │
5. Score each claim:
   - High similarity (>0.6) = confirmed
   - Medium (0.4-0.6) = uncertain
   - Low (<0.4) = drift detected
         │
6. Reporter generates drift report:
   - Per-claim status + evidence
   - Overall health score (0-100)
   - Suggested corrections
```

### Update Flow

```
1. Run drift check (above)
         │
2. Identify drifted conventions
         │
3. Re-run ONLY relevant extractors
   (e.g., if "framework" drifted, re-run stack detection)
         │
4. Update Registry entries (merge, not replace)
         │
5. Re-render ONLY affected marked sections
         │
6. Writer splices new content into existing files
   (manual edits outside markers untouched)
```

### Watch Flow

```
1. Start chokidar watcher on project directory
   - Respect .gitignore (reuse ez-search filtering)
   - Debounce: 5s window
         │
2. On debounced change event:
   │
   ├─ Load cached Registry
   │
   ├─ Check: do changed files overlap with
   │  any convention's evidence files?
   │
   ├─ No overlap → skip (unrelated change)
   │
   └─ Overlap found → run targeted drift check
      for affected conventions only
         │
3. If drift detected:
   - Run targeted update (above)
   - Log what changed
```

---

## Suggested Module Layout

```
src/
├── cli/
│   ├── index.ts                 # Entry point, Commander setup
│   └── commands/
│       ├── generate.ts
│       ├── drift.ts
│       ├── update.ts
│       ├── inspect.ts
│       └── watch.ts
│
├── core/
│   ├── pipeline.ts              # Orchestrates extract → register → emit
│   ├── registry.ts              # Convention Registry (the IR)
│   ├── schema.ts                # TypeScript types, ConventionEntry, etc.
│   └── ez-search-bridge.ts      # Adapter for ez-search API
│
├── extractors/
│   ├── index.ts                 # Extractor runner (parallel execution)
│   ├── types.ts                 # Extractor interface
│   ├── static/
│   │   ├── package-json.ts
│   │   ├── tsconfig.ts
│   │   ├── git.ts
│   │   ├── ci.ts
│   │   └── project-structure.ts
│   └── semantic/
│       ├── clustering.ts
│       ├── architecture.ts
│       └── naming.ts
│
├── emitters/
│   ├── engine.ts                # Template rendering orchestrator
│   ├── writer.ts                # Marker-aware file writer
│   ├── types.ts                 # Emitter interface, OutputFile, etc.
│   └── formats/
│       ├── claude.ts
│       ├── agents.ts
│       ├── cursor.ts
│       ├── copilot.ts
│       ├── skills.ts
│       ├── rulesync.ts
│       └── ruler.ts
│
├── drift/
│   ├── claim-extractor.ts
│   ├── claim-embedder.ts
│   ├── comparator.ts
│   └── reporter.ts
│
├── watch/
│   ├── watcher.ts
│   ├── evidence-filter.ts
│   └── orchestrator.ts
│
└── utils/
    ├── fs.ts                    # File operations
    ├── markers.ts               # Marker parsing/splicing
    └── logger.ts                # Structured logging
```

**Why this layout:**
- **Flat-ish with clear boundaries.** Each top-level directory is a component boundary. No deeply nested structures.
- **Types co-located.** Each component has its own `types.ts` rather than a single monolithic types file. Shared types live in `core/schema.ts`.
- **Extractors and emitters are parallel structures.** Adding a new extractor or a new format follows the same pattern: create a file, implement the interface, register it.

---

## Suggested Build Order

Build order follows dependency chains. Each phase produces something testable.

```
Phase 1: Foundation
  core/schema.ts          ← types first, everything depends on these
  core/registry.ts        ← the IR, central data structure
  core/ez-search-bridge.ts ← adapter layer
  utils/*                 ← shared utilities

Phase 2: Static Extraction
  extractors/types.ts
  extractors/static/*     ← all static extractors
  extractors/index.ts     ← parallel runner

Phase 3: Emission (Basic)
  emitters/types.ts
  emitters/writer.ts      ← marker-aware writer
  emitters/engine.ts      ← template orchestrator
  emitters/formats/claude.ts  ← start with one format
  emitters/formats/agents.ts  ← add second format

Phase 4: CLI (Basic)
  cli/commands/generate.ts
  cli/commands/inspect.ts
  cli/index.ts
  → At this point: `ez-context generate` works end-to-end
    with static extractors producing CLAUDE.md + AGENTS.md

Phase 5: Semantic Extraction
  extractors/semantic/*   ← needs ez-search index
  → Enriches existing pipeline with ML-based conventions

Phase 6: Drift Detection
  drift/*                 ← full drift pipeline
  cli/commands/drift.ts
  → `ez-context drift` works

Phase 7: Targeted Update
  cli/commands/update.ts  ← combines drift + selective re-extract + write
  → `ez-context update` works

Phase 8: Additional Formats
  emitters/formats/cursor.ts
  emitters/formats/copilot.ts
  emitters/formats/skills.ts
  emitters/formats/rulesync.ts
  emitters/formats/ruler.ts

Phase 9: Watch Mode
  watch/*
  cli/commands/watch.ts
  → `ez-context watch` works
```

**Rationale for ordering:**
- **Schema and Registry first** because every other component depends on the type definitions and data structures.
- **Static extractors before semantic** because they work without ez-search index and provide immediate value. You can ship a useful tool before ML-based extraction works.
- **One emitter format before many** because it validates the emitter interface. If the abstraction works for CLAUDE.md, it works for all formats.
- **CLI wired up early (Phase 4)** so you have an end-to-end testable tool quickly. Every subsequent phase adds capability to an already-working tool.
- **Drift after basic generation** because drift detection needs generated files to exist.
- **Watch mode last** because it's purely orchestration on top of everything else.

---

## Patterns to Follow

### Pattern 1: Extractor as Pure Function

**What:** Each extractor is stateless. Given a project path and context, it returns convention entries. No side effects.

**Why:** Enables parallel execution, easy testing, simple composition. If an extractor fails, others continue.

**Example:**

```typescript
// extractors/static/package-json.ts
export const packageJsonExtractor: Extractor = {
  name: 'package-json',
  type: 'static',
  async extract(ctx: ExtractionContext): Promise<ConventionEntry[]> {
    const pkgPath = path.join(ctx.projectPath, 'package.json');
    if (!await fileExists(pkgPath)) return [];

    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const entries: ConventionEntry[] = [];

    // Detect framework
    if (pkg.dependencies?.['hono']) {
      entries.push({
        category: 'stack',
        pattern: 'Hono web framework',
        confidence: 1.0,
        evidence: [{ file: 'package.json', line: null }],
        metadata: { version: pkg.dependencies['hono'] }
      });
    }

    return entries;
  }
};
```

### Pattern 2: Registry as Immutable Snapshot

**What:** The Registry is built once per pipeline run. It's not mutated after construction. Updates create a new Registry.

**Why:** Simplifies reasoning about data flow. No spooky action at a distance. The Registry at any point in time is a complete, consistent snapshot.

### Pattern 3: Emitter Interface with Sections

**What:** Emitters return structured `OutputFile` objects with named sections, not raw strings. The writer uses section metadata for marker-based updates.

**Why:** Decouples content generation from file I/O. Enables the update flow to replace individual sections without re-running the full emitter.

### Pattern 4: Bridge Pattern for ez-search

**What:** A thin adapter (`ez-search-bridge.ts`) wraps ez-search's API, exposing only what ez-context needs: `search(vector, k)`, `embed(text)`, `getManifest()`, `ensureIndex()`.

**Why:** (1) Isolates ez-context from ez-search API changes. (2) Enables testing with mock bridge. (3) Makes the dependency explicit and narrow.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: God Pipeline

**What:** A single pipeline function that handles extraction, registry building, emission, and file writing in one monolithic flow.

**Why bad:** Untestable, can't reuse pieces (drift needs extractors but not emitters), can't add steps without touching everything.

**Instead:** Each stage is a separate function. The pipeline orchestrator composes them. Each stage can be called independently.

### Anti-Pattern 2: Format-Aware Extractors

**What:** Extractors that know about output formats (e.g., an extractor that generates Markdown directly).

**Why bad:** Couples extraction to presentation. Adding a new format requires touching every extractor.

**Instead:** Extractors return structured `ConventionEntry` objects. Emitters handle all formatting.

### Anti-Pattern 3: Implicit State via Filesystem

**What:** Components communicate by writing files and reading them back. (e.g., extractor writes JSON, emitter reads it from disk).

**Why bad:** Hidden dependencies, race conditions, hard to test.

**Instead:** In-memory data flow via function arguments. Disk caching (registry.json) is an explicit, optional step.

### Anti-Pattern 4: Monolithic Template Files

**What:** One giant Handlebars template per output format that contains all logic.

**Why bad:** Templates become unmaintainable as conventions grow. Hard to add/remove sections.

**Instead:** Section-level rendering. Each convention category renders to a section. Sections compose into the final document. Template logic stays minimal -- just layout and formatting.

---

## Template Engine Recommendation

**Use Handlebars** for template rendering. Rationale:

| Criterion | Handlebars | EJS | Eta | Raw string templates |
|-----------|-----------|-----|-----|---------------------|
| Logic separation | Logic-less (good) | Embedded JS (bad for templates) | Embedded TS (moderate) | Manual (worst) |
| Partials/helpers | Built-in | Manual | Manual | Manual |
| Ecosystem | Massive, stable | Massive | Smaller | N/A |
| Customizable | Users can override templates | Yes but risky | Yes | No |
| TypeScript types | @types/handlebars | @types/ejs | Built-in | N/A |

Handlebars' logic-less design forces formatting logic into helpers (TypeScript) rather than templates (strings). This is exactly what we want: the intelligence is in the Convention Registry and helper functions, templates are just layout.

However, for ez-context's use case where templates are relatively simple section-based compositions, **raw TypeScript template functions** are also viable and avoid the dependency. Recommendation: start with raw TypeScript string templates, migrate to Handlebars only if template complexity warrants it.

---

## Scalability Considerations

| Concern | 100-file project | 10K-file project | 100K-file project |
|---------|-----------------|-------------------|-------------------|
| Static extraction | <100ms | <1s | <5s |
| Semantic extraction | <1s (vector queries) | <3s | <10s (batch queries) |
| Registry building | Trivial | Trivial | May need category batching |
| Emission | <100ms | <100ms | <100ms (registry is already compact) |
| Drift check | <500ms (20 claims) | <500ms | <500ms (claims don't scale with codebase) |
| Watch mode | Minimal overhead | Needs evidence filtering | Must filter aggressively |

**Key insight:** The expensive work (embedding, indexing) is in ez-search. ez-context's operations are queries and transformations on already-computed data. Scalability bottleneck is ez-search, not ez-context.

---

## Sources

- [API Extractor Architecture (Microsoft)](https://api-extractor.com/pages/contributing/architecture/) -- Pipeline architecture: Analyzer -> Collector -> Enhancers -> Generators. HIGH confidence.
- [Drift (dadbodgeoff)](https://github.com/dadbodgeoff/drift) -- Pattern detection pipeline, Tree-sitter + regex hybrid, confidence scoring, `.drift/` storage structure. MEDIUM confidence (details from README/wiki, not source code inspection).
- [Rulesync (dyoshikawa)](https://github.com/dyoshikawa/rulesync) -- Multi-format output architecture: unified source -> feature processors -> tool-specific output. HIGH confidence via DeepWiki analysis.
- [EntityFrameworkCore.Generator](https://www.nuget.org/packages/EntityFrameworkCore.Generator) -- Marker/region-based regeneration pattern. HIGH confidence (well-documented NuGet package).
- [Chokidar v4/v5](https://github.com/paulmillr/chokidar) -- ESM-only, TypeScript-native, Node.js v20+ minimum. HIGH confidence.
- [TypeScript Plugin Architecture (Codeless Code)](https://code.lol/post/programming/plugin-architecture/) -- Type-safe plugin patterns with discriminated unions. MEDIUM confidence.
- [Registry Pattern (Martin Fowler)](https://martinfowler.com/eaaCatalog/registry.html) -- Centralized object registry as architectural pattern. HIGH confidence.
