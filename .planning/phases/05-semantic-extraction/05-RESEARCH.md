# Phase 5: Semantic Extraction - Research

**Researched:** 2026-02-28
**Domain:** Embedding-based clustering, DBSCAN, architecture/error-handling pattern detection
**Confidence:** HIGH

## Summary

Phase 5 adds two semantic extractors to the existing pipeline: one that detects error-handling patterns and one that detects architecture patterns (MVC, feature-based, layer-based). Both use the same approach: issue targeted semantic search queries via the existing `EzSearchBridge.search()` method, analyse the returned text chunks with deterministic heuristics, and emit `ConventionEntry` records.

The critical blocker -- `EzSearchBridge.embed()` is a stub -- is confirmed. `@ez-corp/ez-search` v1.3.0 exposes only `index`, `query`, and `status` in its public API. No standalone embed endpoint exists. However, `search()` already works and is the correct primitive for this phase: issue short, targeted natural-language queries (e.g., "error handling try catch") to retrieve the most semantically relevant code chunks, then classify those chunks with regex/string heuristics. No raw embedding vectors are needed.

DBSCAN with raw embedding vectors is therefore not the right approach for this phase. The prior decision to use "in-house DBSCAN + ml-kmeans" was based on an assumption that raw embeddings would be accessible. They are not -- the vector store (`@zvec/zvec`) is internal to ez-search. The correct substitute is **search-then-classify**: use `bridge.search(query, { k: 30 })` for each semantic category, then classify the returned chunks into patterns with lightweight heuristics. This is simpler (~80 lines per extractor), more reliable (no epsilon-tuning needed), and integrates cleanly with the existing `Extractor` interface.

**Primary recommendation:** Use `bridge.search()` for semantic retrieval + regex/string heuristics for pattern classification. Skip raw embedding clustering entirely for this phase.

## Standard Stack

No new dependencies are needed for Phase 5. All required tools are already installed.

### Core (already in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ez-corp/ez-search` | `*` (v1.3.0) | Semantic search via `bridge.search()` | Already used, only semantic retrieval API |
| `ts-morph` | `^27` | AST parsing for error-handling structural checks | Already used by naming/imports extractors |
| `globby` | `^14` | File listing | Already used throughout |

### Not Needed
| Prior Assumption | Reality | Action |
|-----------------|---------|--------|
| `ml-kmeans ^7.0.0` | No raw embeddings accessible | Do not install |
| In-house DBSCAN | No raw embeddings accessible | Do not implement |
| `hdbscan-ts` | No raw embeddings accessible | Do not install |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended File Structure

```
src/extractors/
├── semantic/
│   ├── error-handling.ts       # EXTR-06: error handling pattern extractor
│   └── architecture.ts         # EXTR-07: architecture pattern extractor
└── index.ts                    # Add semantic extractors to ALL_EXTRACTORS
```

### Pattern 1: Search-Then-Classify Extractor

**What:** Issue multiple targeted `bridge.search()` queries, aggregate chunks, classify with deterministic heuristics, emit `ConventionEntry` records.

**When to use:** Any pattern that requires semantic understanding of code but doesn't need raw embedding vectors.

**Example structure:**
```typescript
// src/extractors/semantic/error-handling.ts
import type { Extractor, ExtractionContext } from "../types.js";
import type { ConventionEntry } from "../../core/schema.js";
import { createBridge } from "../../core/ez-search-bridge.js";

type Entry = Omit<ConventionEntry, "id">;

export const errorHandlingExtractor: Extractor = {
  name: "error-handling-semantic",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const bridge = await createBridge(ctx.projectPath);

    // Graceful degradation: skip if no index
    if (!(await bridge.hasIndex(ctx.projectPath))) {
      return [];
    }

    const chunks = await bridge.search("error handling try catch throw", { k: 30 });
    if (chunks.length === 0) return [];

    // Classify chunks into patterns...
    return classifyErrorPatterns(chunks);
  },
};
```

**Why this approach:**
- `bridge.search()` is the only available semantic API
- No new dependencies required
- Same `Extractor` interface as all existing extractors
- Promise.allSettled in `runExtractors` handles failures gracefully
- If no index exists, return empty array (graceful degradation)

### Pattern 2: EzSearchBridge Integration

The semantic extractors need access to `EzSearchBridge`. The cleanest pattern is to call `createBridge(ctx.projectPath)` inside `extract()`. This matches how the existing bridge factory works and avoids dependency injection complexity.

```typescript
// Inside extract():
const bridge = await createBridge(ctx.projectPath);
if (!(await bridge.hasIndex(ctx.projectPath))) {
  return []; // No index -- skip silently
}
```

**Note:** `createBridge` is fast (no I/O, just constructs the impl class). `hasIndex` is a synchronous filesystem check wrapped in a promise. The `search()` call triggers model loading on first use (~30s cold start), but this is expected behavior surfaced by existing UX in Phase 4.

### Pattern 3: Pipeline Integration

In `src/core/pipeline.ts`, the semantic extractors join `ALL_EXTRACTORS` alongside static ones. No special handling required -- `runExtractors` with `Promise.allSettled` already isolates failures.

```typescript
// src/core/pipeline.ts
import { errorHandlingExtractor } from "../extractors/semantic/error-handling.js";
import { architectureExtractor } from "../extractors/semantic/architecture.js";

const ALL_EXTRACTORS = [
  // ... existing extractors ...
  errorHandlingExtractor,
  architectureExtractor,
];
```

### Architecture Info Population

Phase 5 should populate `registry.architecture` for architecture patterns. The pipeline already has an `ArchitectureInfo` schema:

```typescript
// schema.ts
export const ArchitectureInfoSchema = z.object({
  pattern: z.string().optional(),   // "MVC" | "feature-based" | "layer-based"
  layers: z.array(z.string()),       // ["models/", "views/", "controllers/"]
  entryPoints: z.array(z.string()).optional(),
});
```

The architecture extractor should both emit `ConventionEntry` records (for the conventions array) AND update `registry.architecture`. This requires a small addition to `populateArchitectureInfo` in `pipeline.ts` -- similar to the existing `populateStackInfo` post-pass.

### Anti-Patterns to Avoid

- **Calling `bridge.embed()`:** It throws "not supported". Never call it.
- **Reading from `.ez-search/` directly:** Don't parse the vector store or manifest -- use the bridge API.
- **Failing when no index exists:** Return `[]` gracefully. The generate command already handles no-index state via `--fast` / spinner messaging.
- **Issuing too many search queries:** Each `bridge.search()` call may trigger model loading. Use 2-4 targeted queries per extractor, not dozens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semantic retrieval | Custom vector similarity | `bridge.search()` | Already works, model already loaded |
| File listing | Custom glob | `listProjectFiles()` from `utils/fs.ts` | Respects .gitignore, established in Phase 2 |
| UUID generation | Custom id | `crypto.randomUUID()` in `addConvention` | Already handled by registry |
| DBSCAN on raw vectors | In-house DBSCAN | N/A (not needed) | No raw vectors accessible |

**Key insight:** The search API does the hard clustering work internally (HNSW vector search in Zvec). Phase 5 doesn't need to re-implement it.

## Error Handling Pattern Detection (EXTR-06)

### What to Detect

The goal is to identify which error-handling paradigm the project uses:

| Pattern | Detection Signals | Example Code |
|---------|------------------|--------------|
| `try/catch` imperative | Chunks with `try {`, `catch (`, `finally {` | Standard JS/TS |
| `Result<T, E>` / `Either` | Chunks with `Result<`, `Ok(`, `Err(`, `isOk`, `isErr`, `neverthrow` | Functional style |
| Custom error classes | Chunks with `class.*Error extends`, `new.*Error(` | OOP style |
| Error boundaries | Chunks with `ErrorBoundary`, `componentDidCatch` | React |
| Panic/unwrap | Chunks with `.unwrap()`, `panic!`, `expect(` | Rust-influenced |

### Search Queries to Issue

```typescript
// Query 1: General error handling
const chunks1 = await bridge.search("error handling try catch throw exception", { k: 30 });

// Query 2: Functional/Result types
const chunks2 = await bridge.search("Result Ok Err return error value", { k: 20 });

// Query 3: Custom error classes
const chunks3 = await bridge.search("custom error class extends Error", { k: 20 });
```

### Classification Heuristics

After retrieving chunks, classify by counting pattern occurrences across distinct files:

```typescript
function classifyErrorPatterns(chunks: SearchResult[]): Entry[] {
  const tryCatchFiles = new Set<string>();
  const resultTypeFiles = new Set<string>();
  const customErrorFiles = new Set<string>();

  for (const chunk of chunks) {
    if (/\btry\s*\{/.test(chunk.chunk) && /\bcatch\s*\(/.test(chunk.chunk)) {
      tryCatchFiles.add(chunk.file);
    }
    if (/\bResult<|\bOk\(|\bErr\(|\bisOk\b|\bisErr\b/.test(chunk.chunk)) {
      resultTypeFiles.add(chunk.file);
    }
    if (/class\s+\w+Error\b|\bnew\s+\w+Error\(/.test(chunk.chunk)) {
      customErrorFiles.add(chunk.file);
    }
  }

  const entries: Entry[] = [];
  const totalFiles = chunks.map(c => c.file);
  const uniqueFiles = new Set(totalFiles).size;

  if (tryCatchFiles.size >= 2) {
    entries.push({
      category: "error_handling",
      pattern: "try/catch imperative error handling",
      confidence: Math.min(0.95, 0.5 + (tryCatchFiles.size / uniqueFiles) * 0.45),
      evidence: Array.from(tryCatchFiles).slice(0, 5).map(f => ({ file: f, line: null })),
      metadata: { style: "try-catch", fileCount: tryCatchFiles.size },
    });
  }
  // ... similar for Result types, custom errors
  return entries;
}
```

### Confidence Calibration

| Evidence | Confidence |
|----------|-----------|
| 1 file | 0.3 (too sparse, skip) |
| 2-3 files | 0.5-0.65 |
| 4-9 files | 0.65-0.85 |
| 10+ files | 0.85-0.95 (cap) |

Use `Math.min(0.95, 0.5 + (matchingFiles / totalRetrieved) * 0.45)` -- same formula as existing extractors.

## Architecture Pattern Detection (EXTR-07)

### What to Detect

| Pattern | Key Signals | Directory Indicators |
|---------|------------|---------------------|
| MVC | `models/`, `views/`, `controllers/` directories | `/models`, `/views`, `/controllers` (or `model`, `view`, `controller`) |
| Feature-based | Feature directories with co-located components | `/features/`, `/modules/` with sub-dirs containing UI+logic |
| Layer-based | Horizontal layers | `/domain/`, `/application/`, `/infrastructure/` OR `/services/`, `/repositories/`, `/handlers/` |
| Unknown | Doesn't match above | Default |

### Approach: Directory Structure Heuristics + Semantic Search

Architecture detection is best done with **two complementary signals**:

1. **Directory structure scan** (via `listProjectFiles` + directory name analysis) -- HIGH confidence, no search needed
2. **Semantic search for confirmation** -- adds evidence references

```typescript
// Signal 1: Directory names (fast, deterministic)
const files = await listProjectFiles({ cwd: ctx.projectPath, extensions: ["ts", "js"] });
const topDirs = extractTopDirectories(files);  // ["src/models", "src/views", "src/controllers"]

// Signal 2: Semantic confirmation
const chunks = await bridge.search("model view controller route handler service repository", { k: 20 });
```

### MVC Signal Detection

```typescript
function detectMvc(topDirs: string[]): boolean {
  const hasMvcDir = (d: string) =>
    /\b(model|view|controller|route)s?\b/i.test(d);
  const mvcDirCount = topDirs.filter(hasMvcDir).length;
  return mvcDirCount >= 2;  // At least 2 of 3 MVC dirs must be present
}
```

### Feature-Based Detection

```typescript
function detectFeatureBased(files: string[]): boolean {
  // Feature-based: deep directory trees where sibling dirs each contain
  // multiple file types (co-location of UI + logic)
  const featureDirPatterns = /\/(features?|modules?|pages?)\//i;
  const featureFiles = files.filter(f => featureDirPatterns.test(f));
  return featureFiles.length >= 5;  // At least 5 files under feature dirs
}
```

### Layer-Based Detection

```typescript
function detectLayerBased(topDirs: string[]): boolean {
  const layerPatterns = [
    /\b(domain|application|infrastructure)\b/i,      // DDD layers
    /\b(service|repository|handler|usecase)\b/i,     // Hexagonal
    /\b(core|data|presentation|network)\b/i,         // Clean arch
  ];
  const layerMatches = topDirs.filter(d => layerPatterns.some(p => p.test(d)));
  return layerMatches.length >= 2;
}
```

### ArchitectureInfo Population

The architecture extractor should also update `registry.architecture` by setting `pattern` and `layers`:

```typescript
// In pipeline.ts, add populateArchitectureInfo() post-pass:
function populateArchitectureInfo(registry: ConventionRegistry): ConventionRegistry {
  const arch = { ...registry.architecture };
  for (const entry of registry.conventions) {
    if (entry.category === "architecture" && !arch.pattern) {
      if (typeof entry.metadata?.architecturePattern === "string") {
        arch.pattern = entry.metadata.architecturePattern;
      }
    }
  }
  return { ...registry, architecture: arch };
}
```

## Common Pitfalls

### Pitfall 1: Calling embed() -- Fatal

**What goes wrong:** `bridge.embed()` throws `"embed() is not yet supported"`. Any code that calls it will cause the extractor to fail and be skipped silently by `runExtractors`.
**Why it happens:** Confusion between the planned API (embed) and the available API (search).
**How to avoid:** Use `bridge.search()` exclusively. Never import or call `embed()`.
**Warning signs:** Extractor returns no results; `console.warn` in test output showing "embed() is not yet supported".

### Pitfall 2: No Index -- Silent Empty Results

**What goes wrong:** If no `.ez-search/` index exists, `bridge.search()` returns `[]` (EzSearchBridge catches the `NO_INDEX` error and returns empty). Extractors return no conventions.
**Why it happens:** User hasn't run `ez-search index` or is using `--fast` mode.
**How to avoid:** Check `bridge.hasIndex()` first and return `[]` early. This is the correct behavior -- semantic extractors are optional enhancements.
**Warning signs:** All semantic extractors return 0 entries even on a well-indexed project.

### Pitfall 3: Model Cold Start in Tests

**What goes wrong:** Integration tests that actually call `bridge.search()` will trigger ONNX model loading (~30-60s on CPU). This makes tests extremely slow.
**Why it happens:** `@ez-corp/ez-search` loads the Qwen3-Embedding-0.6B model on first query.
**How to avoid:** Mock `createBridge` in all unit tests (same pattern as `ez-search-bridge.test.ts`). Only exercise real search in integration tests tagged `@integration`.
**Warning signs:** Test suite takes >2 minutes; "loading model..." output in test logs.

### Pitfall 4: Over-Counting From Chunk Overlap

**What goes wrong:** A single large file may produce multiple overlapping chunks (500-token windows, 50-token overlap). Counting chunk occurrences inflates evidence.
**Why it happens:** ez-search chunks files at 500 tokens with 50-token overlap. One file = multiple chunks.
**How to avoid:** Deduplicate by `chunk.file` before counting for confidence calculations. Use `Set<string>` of file paths, not raw chunk count.
**Warning signs:** Confidence values > 0.95 from very few actual files.

### Pitfall 5: Architecture Test on Own Codebase Yields False Results

**What goes wrong:** Running the architecture extractor on the ez-context project itself detects "layer-based" because ez-context has `src/core/`, `src/extractors/`, `src/emitters/` directories.
**Why it happens:** The tool's own structure matches layer patterns.
**How to avoid:** This is expected behavior, not a bug. Tests should use a synthetic project directory.
**Warning signs:** Tests detect "layer-based" when running on `/home/dev/work/ez-context` itself.

### Pitfall 6: Search Queries Too Broad

**What goes wrong:** A query like "code" retrieves irrelevant chunks with near-zero signal, producing false positives.
**Why it happens:** HNSW vector search with high topK returns everything remotely similar.
**How to avoid:** Use targeted, specific queries with 4-6 relevant keywords. Use `threshold` option (score > 0.5) if needed. Limit `k` to 20-30.
**Warning signs:** Extractors detect patterns in unrelated projects; confidence values cluster near 0.5.

## Code Examples

### Minimal Semantic Extractor Structure

```typescript
// Source: mirrors naming.ts and imports.ts patterns from Phase 2
import type { Extractor, ExtractionContext } from "../types.js";
import type { ConventionEntry } from "../../core/schema.js";
import { createBridge } from "../../core/ez-search-bridge.js";

type Entry = Omit<ConventionEntry, "id">;

export const errorHandlingExtractor: Extractor = {
  name: "error-handling-semantic",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const bridge = await createBridge(ctx.projectPath);

    // Graceful degradation: if no index, skip silently
    if (!(await bridge.hasIndex(ctx.projectPath))) {
      return [];
    }

    const chunks = await bridge.search(
      "error handling try catch throw exception",
      { k: 30 }
    );

    if (chunks.length === 0) return [];

    // Deduplicate by file path (chunks have 50-token overlap)
    const byFile = new Map<string, string[]>();
    for (const chunk of chunks) {
      const existing = byFile.get(chunk.file) ?? [];
      existing.push(chunk.chunk);
      byFile.set(chunk.file, existing);
    }

    const entries: Entry[] = [];
    // ... classify patterns using byFile...
    return entries;
  },
};
```

### Test Pattern (Mocking the Bridge)

```typescript
// Source: mirrors ez-search-bridge.test.ts vi.mock pattern
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn().mockResolvedValue({
    hasIndex: vi.fn().mockResolvedValue(true),
    search: vi.fn().mockResolvedValue([
      { file: "src/auth.ts", chunk: "try { await login() } catch (err) { ... }", score: 0.85 },
      { file: "src/db.ts", chunk: "try { query() } catch (e) { throw new DbError(e) }", score: 0.80 },
    ]),
    embed: vi.fn().mockRejectedValue(new Error("embed() is not yet supported")),
    ensureIndex: vi.fn(),
  }),
}));

import { errorHandlingExtractor } from "../../src/extractors/semantic/error-handling.js";

describe("errorHandlingExtractor", () => {
  it("detects try/catch pattern from search results", async () => {
    const entries = await errorHandlingExtractor.extract({ projectPath: "/fake" });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.pattern).toContain("try/catch");
    expect(entries[0]!.category).toBe("error_handling");
  });
});
```

### Architecture Extractor: Directory Scan

```typescript
// Source: mirrors project-structure.ts pattern from Phase 2
import { listProjectFiles } from "../../utils/fs.js";

function extractTopLevelDirs(files: string[]): string[] {
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.split("/");
    if (parts.length > 1) dirs.add(parts.slice(0, 2).join("/"));
  }
  return Array.from(dirs);
}
```

## State of the Art

| Old Approach (Prior Research) | Current Approach (This Research) | Impact |
|-------------------------------|----------------------------------|--------|
| DBSCAN on raw 768-dim vectors | Search-then-classify heuristics | Simpler, no epsilon-tuning, no new deps |
| `ml-kmeans ^7.0.0` for refinement | Not needed | Don't install |
| In-house DBSCAN (~80 lines) | Not needed | Don't implement |
| `EzSearchBridge.embed()` | `EzSearchBridge.search()` | search() already works |

**Why the change:** The prior research (SUMMARY.md) assumed raw embedding vectors would be accessible. They are not: `@ez-corp/ez-search` v1.3.0's `model-router.js`/`createEmbeddingPipeline` is an internal module only used by the query pipeline. The vector store (`@zvec/zvec`) is also internal. The only public-facing semantic API is `query()` (wrapped by `bridge.search()`).

## Open Questions

1. **`ArchitectureInfo.layers` population**
   - What we know: `ArchitectureInfo.layers` is `z.array(z.string())` (required field). `createRegistry` initializes it to `[]`.
   - What's unclear: Should the architecture extractor populate it with detected top-level directories, or leave it empty when unknown?
   - Recommendation: Populate with the top-level `src/` subdirectories detected. E.g., `["src/models", "src/views", "src/controllers"]`. This gives emitters something concrete to render.

2. **`--fast` flag and semantic extractors**
   - What we know: Phase 4 implemented `--fast` mode. Semantic extractors don't currently check for it.
   - What's unclear: Should semantic extractors be skipped when `--fast` is passed?
   - Recommendation: Add an `options.fast?: boolean` to `ExtractorOptions` and check it in semantic extractors. Return `[]` immediately if `fast === true`. This is consistent with the cold-start UX strategy from Phase 4.

3. **Confidence when search returns 0 results with an index**
   - What we know: If the project uses no try/catch at all, `bridge.search("try catch")` returns `[]`.
   - What's unclear: Should we emit a "no error handling pattern detected" entry or just return `[]`?
   - Recommendation: Return `[]`. The absence of a convention entry is correct -- don't emit conventions about things the project doesn't do.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `/home/dev/work/ez-context/node_modules/@ez-corp/ez-search/dist/index.js` -- confirms public API is `index`, `query`, `status` only
- Codebase inspection: `/home/dev/work/ez-context/node_modules/@ez-corp/ez-search/dist/services/model-router.js` -- confirms `createEmbeddingPipeline` is internal
- Codebase inspection: `/home/dev/work/ez-context/node_modules/@ez-corp/ez-search/dist/services/vector-db.js` -- confirms `@zvec/zvec` is internal
- Codebase inspection: `/home/dev/work/ez-context/src/core/ez-search-bridge.ts` -- confirms `embed()` throws; `search()` works
- Codebase inspection: `/home/dev/work/ez-context/src/core/schema.ts` -- confirms `ArchitectureInfo` schema
- Codebase inspection: `/home/dev/work/ez-context/src/extractors/types.ts` -- confirms `Extractor` interface
- Codebase inspection: `/home/dev/work/ez-context/src/core/pipeline.ts` -- confirms how extractors are registered

### Secondary (MEDIUM confidence)
- WebSearch: hdbscan-ts (v1.0.16, 785 weekly downloads) -- confirmed via npm search; viable if raw vectors become accessible
- WebSearch: DBSCAN eps=0.10-0.30 for normalized 768-dim embeddings -- consistent across multiple sources
- WebSearch: directory-structure heuristics for MVC/feature/layer detection -- verified by MDPI paper on architectural pattern detection

### Tertiary (LOW confidence)
- WebSearch: `density-clustering` npm (last published 10 years ago) -- do not use
- WebSearch: cosine distance clustering for high-dimensional embeddings -- general guidance, not code-embedding-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified by reading actual package files
- Architecture patterns: HIGH -- verified by reading existing extractor source and pipeline code
- Embedding API: HIGH -- verified by reading ez-search dist files directly
- Pitfalls: HIGH -- derived from confirmed codebase facts (embed() stub, chunk overlap behavior, model cold start)
- DBSCAN parameters: MEDIUM -- general ML guidance, not verified against this specific use case

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable -- ez-search v1.3.0 is pinned via `*` but unlikely to change API)
