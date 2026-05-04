# Architecture

This document describes the internals of ez-context for contributors. For usage, see [README.md](./README.md).

## Overview

ez-context has four commands (`generate`, `inspect`, `drift`, `update`) built on three core subsystems:

1. **Extraction pipeline** -- scans project files and produces a structured convention registry
2. **Emitter system** -- renders the registry into various output formats
3. **Drift engine** -- compares existing context files against the codebase to detect staleness

```
Codebase
   |
   v
Extractors (static + code + semantic)
   |
   v
Convention Registry (Zod-validated JSON)
   |
   v
Emitters (claude, agents, cursor, copilot, skills, rulesync, ruler)
   |
   v
Output files (with marker-based preservation of manual edits)
```

---

## Source Layout

```
src/
  cli.ts                          Entry point, Commander.js program
  index.ts                        Public API exports

  commands/
    generate.ts                   generate command handler
    inspect.ts                    inspect command handler
    drift.ts                      drift command handler
    update.ts                     update command handler

  core/
    schema.ts                     Convention registry Zod schemas + inferred types
    registry.ts                   Immutable registry construction (createRegistry, addConvention)
    pipeline.ts                   Extraction orchestration, deduplication, StackInfo/ArchInfo population
    ez-search-bridge.ts           Bridge to @ez-corp/ez-search for semantic search
    updater.ts                    Targeted update engine (marker validation, backup, re-render)
    drift/
      claim-extractor.ts          Parse context files into individual testable claims
      claim-scorer.ts             Score claims against code index via semantic search

  extractors/
    index.ts                      runExtractors — parallel execution with Promise.allSettled
    types.ts                      Extractor interface and ExtractionContext type
    static/                       File-based extractors (no AST, no ML)
      package-json.ts             Dependencies, scripts, engines
      lockfile.ts                 Package manager detection
      tsconfig.ts                 TypeScript strictness settings
      cargo-toml.ts               Rust crate detection
      go-mod.ts                   Go module detection
      ci.ts                       CI/CD pipeline detection
      project-structure.ts        Directory layout analysis
    code/                         AST-based extractors (ts-morph)
      imports.ts                  Import pattern analysis
      naming.ts                   Naming convention detection (camelCase, snake_case, etc.)
    semantic/                     Higher-level pattern extractors
      error-handling.ts           Error handling style detection
      architecture.ts             Architecture layer detection

  emitters/
    index.ts                      FORMAT_EMITTER_MAP registry + emit() function
    types.ts                      OutputFormat, EmitOptions, EmitResult types
    writer.ts                     Marker-based file writer (writeWithMarkers)
    render-helpers.ts             Shared rendering utilities
    claude-md.ts                  CLAUDE.md renderer
    agents-md.ts                  AGENTS.md renderer
    cursor-mdc.ts                 Cursor .mdc renderer
    copilot-md.ts                 Copilot instructions renderer
    skill-md.ts                   SKILL.md renderer
    rulesync-md.ts                Rulesync renderer
    ruler-md.ts                   Ruler renderer
```

---

## Core Data Model

The central data structure is the `ConventionRegistry`, defined in `src/core/schema.ts` using Zod:

```
ConventionRegistry
  version: "1"
  projectPath: string
  generatedAt: ISO datetime
  stack: StackInfo
    language, framework, testRunner, buildTool, packageManager
  conventions: ConventionEntry[]
    id: UUID
    category: stack | naming | architecture | error_handling | testing | imports | other
    pattern: string (human-readable description)
    confidence: 0.0 - 1.0
    evidence: EvidenceRef[] (file + line)
    metadata: Record<string, unknown> (extractor-specific data)
  architecture: ArchitectureInfo
    pattern, layers, entryPoints
```

All types are inferred from the Zod schema -- there are no separate interface definitions. Validation happens at the end of the pipeline via `ConventionRegistrySchema.parse()`.

---

## Extraction Pipeline

Defined in `src/core/pipeline.ts`. The function `extractConventions(projectPath)` orchestrates:

1. **Create empty registry** via `createRegistry(projectPath)`
2. **Run all extractors in parallel** via `runExtractors()` using `Promise.allSettled` -- a failing extractor logs a warning and does not block others
3. **Deduplicate conventions** by `category:pattern` key, keeping higher confidence, merging evidence arrays
4. **Populate StackInfo** from convention metadata (first match wins per field)
5. **Populate ArchitectureInfo** from architecture convention metadata
6. **Validate** the final registry against the Zod schema

### Extractor Interface

Every extractor implements the `Extractor` interface from `src/extractors/types.ts`:

```typescript
interface Extractor {
  name: string;
  extract(ctx: ExtractionContext): Promise<Omit<ConventionEntry, "id">[]>;
}
```

`ExtractionContext` provides `projectPath` and optional `ExtractorOptions` (e.g. `maxFilesForAst`). The `id` field is assigned by the registry runner, not the extractor.

### Adding a New Extractor

1. Create a file in the appropriate subdirectory (`static/`, `code/`, or `semantic/`)
2. Export an object satisfying the `Extractor` interface
3. Add it to the `ALL_EXTRACTORS` array in `src/core/pipeline.ts`
4. Return `ConventionEntry[]` (minus `id`) with appropriate `category`, `pattern`, `confidence`, and `evidence`
5. Use `metadata` to pass structured data that the pipeline's post-extraction passes can consume (e.g. `metadata.language` for StackInfo population)

Extractors run in parallel and must be stateless -- they receive only the `ExtractionContext` and return conventions.

---

## Emitter System

Defined in `src/emitters/index.ts`. The `FORMAT_EMITTER_MAP` registry maps each output format to:

```typescript
interface FormatEmitterEntry {
  render: (registry: ConventionRegistry, threshold: number) => string;
  filename: string;
  strategy: "markers" | "direct";
}
```

- **`render`** -- pure function that takes the convention registry and confidence threshold, returns a string
- **`filename`** -- relative output path (e.g. `CLAUDE.md`, `.cursor/rules/ez-context.mdc`)
- **`strategy`** -- `"markers"` preserves manual edits via HTML comment markers; `"direct"` overwrites the file entirely

The `emit()` function iterates over requested formats, renders each, and writes files using the appropriate strategy.

### Marker-Based Writing

For formats using the `"markers"` strategy, `writeWithMarkers()` in `src/emitters/writer.ts` handles three cases:

1. **File does not exist** -- creates it with content wrapped in `<!-- ez-context:start -->` / `<!-- ez-context:end -->` markers
2. **File exists, no markers** -- appends the marker-wrapped section at the end
3. **File exists with markers** -- replaces content between markers, preserving everything outside

This allows developers to add manual content to their context files without it being overwritten on regeneration.

### Adding a New Output Format

1. Create a renderer in `src/emitters/` (e.g. `my-format.ts`) exporting a function `(registry, threshold) => string`
2. Add the format name to the `OutputFormat` union in `src/emitters/types.ts`
3. Register it in `FORMAT_EMITTER_MAP` in `src/emitters/index.ts` with filename and write strategy
4. Add the format to `VALID_FORMATS` in `src/commands/generate.ts`

---

## Drift Detection

The drift system compares claims in existing context files against the codebase using semantic search via `@ez-corp/ez-search`.

### Claim Extraction (`src/core/drift/claim-extractor.ts`)

Parses markdown context files into atomic claims by:
- Extracting bullet points and numbered list items
- Stripping bold/code markers
- Filtering out boilerplate key-value lines, short strings, and HTML comments
- Tracking the parent section heading for context

### Claim Scoring (`src/core/drift/claim-scorer.ts`)

Each claim is searched against the code index. The top similarity score classifies it:
- **GREEN** (>= 0.65) -- well-supported by code evidence
- **YELLOW** (>= 0.40) -- possibly stale
- **RED** (< 0.40) -- contradicted or unsupported

Claims are processed in batches of 10 to manage resource usage.

### Health Score

The drift report aggregates scored claims into a 0-100 health score. Higher means the context file accurately reflects the codebase.

---

## Update Engine

Defined in `src/core/updater.ts`. The `updateFile()` function handles targeted regeneration:

**For marker-strategy files:**
1. Validate marker integrity (abort on unpaired or inverted markers)
2. Extract and score claims -- skip if no drift detected
3. Create `.bak` backup
4. Re-render the format and splice via `writeWithMarkers()`

**For direct-strategy files:**
1. Create `.bak` backup
2. Re-render and overwrite

This means only files with actual drift get rewritten, and manual content outside markers is always preserved.

---

## Key Design Decisions

**Immutable registry** -- `addConvention()` returns a new registry object rather than mutating in place. This simplifies the parallel extraction pipeline.

**Zod-first types** -- all types are inferred from Zod schemas (`z.infer<typeof ...>`). No duplicate interface definitions to keep in sync.

**Extractor isolation** -- each extractor is independent with no shared state. `Promise.allSettled` ensures one failure doesn't cascade.

**Marker preservation** -- the `<!-- ez-context:start/end -->` convention lets ez-context own its sections while respecting user content. Formats where this doesn't make sense (Cursor `.mdc`, SKILL.md, Ruler) use direct overwrite instead.

**Confidence as first-class** -- every convention carries a confidence score. The threshold flag gives users control over how aggressive the output is, and drift detection uses the same scoring model.
