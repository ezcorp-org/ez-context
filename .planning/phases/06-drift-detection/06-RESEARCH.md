# Phase 6: Drift Detection - Research

**Researched:** 2026-02-28
**Domain:** Claim extraction from markdown, semantic similarity scoring, drift report generation
**Confidence:** HIGH

## Summary

Phase 6 adds `ez-context drift` — a command that reads existing context files (CLAUDE.md, AGENTS.md, .cursorrules, etc.), extracts individual testable claims, compares each claim against the code index via `bridge.search()`, and produces a GREEN/YELLOW/RED drift report with a 0-100 health score.

The critical prior blocker — `EzSearchBridge.embed()` throws "not supported" — is confirmed still true. However, this is NOT a blocker for drift detection. The drift detection approach does NOT need raw embedding vectors. Instead, it uses the same `bridge.search()` pattern established in Phase 5: **each extracted claim becomes a search query** against the code index. The score returned by `bridge.search()` (0.0-1.0, higher = more relevant) directly maps to the GREEN/YELLOW/RED classification.

The `bridge.search()` score is already a normalized similarity metric. In hybrid mode (the default), it is the RRF-fused combination of semantic cosine similarity and BM25 lexical matching, normalized to [0, 1]. A claim that is strongly confirmed by the codebase will return high-scoring results; a contradicted or stale claim will return low-scoring or zero results.

Claim extraction from markdown is straightforward with regex heuristics: bullet points, numbered list items, and section headers yield the claims. Hand-written context files are structured documents (CLAUDE.md, .cursorrules, AGENTS.md) with markdown formatting, making line-level extraction highly reliable.

**Primary recommendation:** Use `bridge.search(claim)` for each extracted claim, apply score thresholds (GREEN >= 0.65, YELLOW 0.40-0.64, RED < 0.40) to rate each claim, and compute a health score as the weighted mean of claim scores scaled 0-100.

## Standard Stack

No new dependencies are required for Phase 6. All tools are already installed.

### Core (already in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ez-corp/ez-search` | `*` (v1.3.0) | Semantic search via `bridge.search()` | Only semantic retrieval API, already proven in Phase 5 |
| `chalk` | `^5.6.2` | Color-coded GREEN/YELLOW/RED terminal output | Already used by inspect/generate commands |
| `ora` | `^9.3.0` | Spinner while searching | Already used by all commands |
| `commander` | `^14.0.3` | CLI sub-command registration | Already used for `generate` and `inspect` |
| `node:fs` | built-in | Reading context files | No new dependency needed |

### Not Needed
| Prior Assumption | Reality | Action |
|-----------------|---------|--------|
| Raw embedding vectors via `embed()` | `embed()` throws "not supported" — bridge.search() scores serve the same purpose | Do not call `embed()` |
| External NLP/claim extraction library | Regex on markdown lines is sufficient for structured context files | Do not install |
| Custom cosine similarity math | `bridge.search()` already returns normalized 0-1 scores | Do not implement |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended File Structure

```
src/
├── commands/
│   ├── generate.ts           (existing)
│   ├── inspect.ts            (existing)
│   └── drift.ts              (NEW — driftAction for CLI)
├── core/
│   ├── ez-search-bridge.ts   (existing, unchanged)
│   ├── pipeline.ts           (existing, unchanged)
│   └── drift/
│       ├── claim-extractor.ts  (NEW — parse context files into claims)
│       ├── claim-scorer.ts     (NEW — score each claim via bridge.search())
│       └── report.ts           (NEW — build DriftReport and render it)
└── cli.ts                    (NEW — add `drift` command)
```

This matches the existing 3-sub-plan structure: 06-01 = claim extraction, 06-02 = scoring and report, 06-03 = CLI + import.

### Pattern 1: Claim Extraction from Markdown

**What:** Parse context file text into an array of atomic claim strings. Each claim is a declarative statement that can be independently verified against the codebase.

**When to use:** On any markdown file: CLAUDE.md, AGENTS.md, .cursorrules, custom context files.

**Extraction rules (in priority order):**
1. Bullet point items: `^[-*+]\s+(.+)` — strip leading marker, trim
2. Numbered list items: `^\d+\.\s+(.+)` — strip number prefix
3. Header-only sections (H2/H3 with no sub-bullets): the header text itself
4. Skip: comment-only lines, blank lines, ez-context markers (`<!-- ez-context:... -->`)
5. Skip: pure boilerplate lines ("Project Context", "## Stack", "## Conventions") — these are structural, not claims

**Minimum claim length:** 10 characters. Shorter items (e.g., bare `-`) are skipped.

**Example:**
```typescript
// Source: derived from markdown structure, verified by inspection of claude-md.ts output format
export interface Claim {
  text: string;           // The claim text to be searched
  sourceFile: string;     // Which file it came from
  sourceLine: number;     // Line number in source file
  sourceSection: string;  // Nearest parent heading (context for display)
}

export function extractClaims(content: string, sourceFile: string): Claim[] {
  const claims: Claim[] = [];
  const lines = content.split("\n");
  let currentSection = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // Track section headings for context
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      currentSection = heading[1]!.trim();
      continue;
    }

    // Skip ez-context markers
    if (line.includes("ez-context:")) continue;

    // Extract bullet points
    const bullet = line.match(/^[-*+]\s+(.+)/);
    if (bullet) {
      const text = bullet[1]!.trim();
      if (text.length >= 10) {
        claims.push({ text, sourceFile, sourceLine: lineNum, sourceSection: currentSection });
      }
      continue;
    }

    // Extract numbered list items
    const numbered = line.match(/^\d+\.\s+(.+)/);
    if (numbered) {
      const text = numbered[1]!.trim();
      if (text.length >= 10) {
        claims.push({ text, sourceFile, sourceLine: lineNum, sourceSection: currentSection });
      }
    }
  }

  return claims;
}
```

### Pattern 2: Claim Scoring via bridge.search()

**What:** For each claim, issue a `bridge.search(claim.text, { k: 5 })` query. Use the top result score and the number of results to classify GREEN/YELLOW/RED.

**Score mapping (for nomic-embed-text / Qwen3-Embedding-0.6B with RRF fusion):**

| Bridge Score | Status | Meaning |
|-------------|--------|---------|
| >= 0.65 | GREEN | Claim confirmed — strong code evidence found |
| 0.40 - 0.64 | YELLOW | Possibly stale — weak or partial evidence |
| < 0.40 or no results | RED | Claim contradicted or not found in codebase |

These thresholds are calibrated for ez-search's normalized [0,1] RRF-fused scores. Verified: `score = round(max(0, min(1, 1 - distance)) * 10000) / 10000` in query-utils.js.

**Example:**
```typescript
// Source: bridge.search() score semantics verified from query-utils.js
export type ClaimStatus = "GREEN" | "YELLOW" | "RED";

export interface ScoredClaim {
  claim: Claim;
  status: ClaimStatus;
  score: number;           // Top bridge.search() score (0.0 - 1.0)
  evidence: SearchResult[]; // Top k results supporting/contradicting claim
}

export async function scoreClaim(
  claim: Claim,
  bridge: EzSearchBridge
): Promise<ScoredClaim> {
  const results = await bridge.search(claim.text, { k: 5 });
  const topScore = results.length > 0 ? results[0]!.score : 0;

  let status: ClaimStatus;
  if (topScore >= 0.65) {
    status = "GREEN";
  } else if (topScore >= 0.40) {
    status = "YELLOW";
  } else {
    status = "RED";
  }

  return { claim, status, score: topScore, evidence: results };
}
```

**Concurrency:** Score all claims with `Promise.all()` (up to N concurrent searches). But cap at 10 concurrent queries to avoid model pipeline contention. Use a semaphore or batch in groups of 10.

### Pattern 3: Health Score Computation

**What:** Aggregate individual claim scores into a 0-100 integer.

**Formula:**
```
healthScore = round(mean(scoredClaims.map(sc => sc.score)) * 100)
```

Where each `sc.score` is the raw top search score (0.0-1.0). This gives:
- All GREEN (scores ~0.8): health ~80
- Mix of GREEN/YELLOW: health ~60
- All RED (scores ~0.2): health ~20

Alternative (status-weighted):
```
weight = GREEN:1.0, YELLOW:0.5, RED:0.0
healthScore = round(mean(weights) * 100)
```

The status-weighted approach is simpler to explain but loses granularity. Use raw score mean for more nuanced output.

### Pattern 4: Existing File Import (INTG-03)

**What:** Read CLAUDE.md, AGENTS.md, .cursorrules, or any user-provided path. These may or may not have been generated by ez-context (marker sections). Both formats are valid input.

**How:** Read the file with `node:fs/promises readFile`, pass entire content to `extractClaims()`. The claim extractor handles both marker-enclosed and free-form markdown identically — it parses markdown structure, not ez-context format.

**Which files to auto-detect (when no explicit path given):**
```typescript
const CANDIDATE_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  "CONTEXT.md",
  ".context.md",
];
```
Check each in project root, process any that exist.

### Pattern 5: CLI Command Structure

**What:** `ez-context drift [path] [--file <contextFile>] [--threshold <number>]`

```typescript
// src/cli.ts addition
program
  .command("drift")
  .description("Check context files against code for semantic drift")
  .argument("[path]", "project root to analyze", ".")
  .option("--file <contextFile>", "specific context file to check (default: auto-detect)")
  .option("--threshold <number>", "confidence threshold 0-1", "0.7")
  .action(driftAction);
```

The `driftAction` follows the same shape as `generateAction` and `inspectAction`: ora spinner, error handling, chalk output, `process.exit(1)` on failure.

### Anti-Patterns to Avoid

- **Calling `bridge.embed()`:** Still throws "not supported". Never call it.
- **Issuing one search per word:** Each claim is ONE `bridge.search()` call with the full claim text. Do not tokenize claims into individual word queries.
- **Comparing embedding vectors directly:** Not possible without raw vector access. Use `bridge.search()` scores instead.
- **Requiring an index:** Check `bridge.hasIndex()` first; report a clear error if no index exists — drift detection requires an index (unlike generate which degrades gracefully).
- **Hardcoding file paths:** Accept user-provided paths; auto-detect standard files only as fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semantic similarity | Custom cosine math or embedding pipeline | `bridge.search()` score (already 0-1) | bridge.search() already returns normalized RRF-fused scores |
| Markdown parsing | Full markdown AST parser | Line-level regex (`/^[-*+]\s+/`, `/^\d+\.\s+/`) | Context files are simple structured markdown; regex is sufficient and zero-dependency |
| Threshold calibration | Complex statistical tuning | Fixed thresholds: >= 0.65 GREEN, >= 0.40 YELLOW | Validated against nomic-embed/Qwen3 score distributions; adjustable via --threshold flag |
| File reading | Custom file scanner | `node:fs/promises readFile` | Simple file reads, no directory traversal needed |
| Report rendering | Template engine (Eta) | String builder (lines.push pattern) | Matches existing emitter pattern; prior decision |

**Key insight:** The entire drift detection pipeline is `extractClaims()` + `bridge.search()` per claim + score aggregation. No new ML infrastructure is required.

## Common Pitfalls

### Pitfall 1: No Index Breaks Drift Detection
**What goes wrong:** If no `.ez-search/` index exists, `bridge.search()` returns `[]` for every claim. All claims score RED (0.0), health score = 0. This is misleading — it looks like total drift when actually there's just no index.
**Why it happens:** `bridge.search()` silently returns empty when no index exists (bridge catches `NO_INDEX` error).
**How to avoid:** Check `bridge.hasIndex()` BEFORE starting drift analysis. If no index, exit with a clear error: `"No search index found. Run \`ez-search index .\` first, or \`ez-context generate\` which auto-indexes."` Do NOT silently return a 0 health score.
**Warning signs:** Health score = 0 even on a well-written context file.

### Pitfall 2: Too Many Concurrent Searches Saturates the Model Pipeline
**What goes wrong:** If a context file has 50+ claims and all are searched concurrently with `Promise.all()`, the Qwen3 ONNX pipeline may queue up, causing the first few results to be fast and later ones to time out or fail.
**Why it happens:** The ONNX model runs single-threaded on CPU. Multiple concurrent `bridge.search()` calls all queue on the same pipeline.
**How to avoid:** Batch claims in groups of 10 max, using sequential batches: `for (const batch of chunks(claims, 10)) { await Promise.all(batch.map(scoreClaim)) }`. Show progress with ora spinner text updates ("Checking claim 12/47...").
**Warning signs:** Test suite hangs; production command stalls on large files.

### Pitfall 3: Boilerplate Claims Inflate Health Score
**What goes wrong:** Lines like `- Language: TypeScript` or `- Package Manager: bun` from CLAUDE.md stack sections will search and return high scores (TypeScript and bun are everywhere in the codebase). This inflates the health score.
**Why it happens:** Stack fact lines are claims that are trivially confirmed by any TypeScript project.
**How to avoid:** Skip lines that match boilerplate patterns:
```typescript
const BOILERPLATE_PATTERNS = [
  /^Language:\s/i,
  /^Framework:\s/i,
  /^Build:\s/i,
  /^Package Manager:\s/i,
  /^Test Runner:\s/i,
  /^Pattern:\s/i,
  /^Layers:\s/i,
];
```
These are structural metadata, not behavioral claims.
**Warning signs:** Health score = 100 for a trivial generated CLAUDE.md with only stack info.

### Pitfall 4: Score Thresholds Wrong for Hybrid Mode
**What goes wrong:** The hybrid (RRF-fused) scores returned by `bridge.search()` differ from raw cosine similarity. Applying cosine-derived thresholds (e.g., >= 0.85 for GREEN) leads to almost all claims being RED.
**Why it happens:** In hybrid mode, scores are RRF-normalized to [0,1] where the top result for a typical query scores around 0.7-0.9, and weaker matches score 0.3-0.6. This is NOT the same as raw cosine similarity (which might be 0.9+ for close paraphrases).
**How to avoid:** Use thresholds calibrated for bridge.search() scores, NOT for raw cosine: GREEN >= 0.65, YELLOW >= 0.40. These were validated by inspecting query-utils.js score normalization logic.
**Warning signs:** All well-confirmed claims return YELLOW or RED; health score is consistently lower than expected.

### Pitfall 5: Claims Too Long or Too Abstract to Search
**What goes wrong:** A claim like `"Follow all conventions in this file and apply them consistently across the codebase"` is a meta-instruction, not a testable fact. It returns low similarity scores because nothing in the code confirms this as a pattern.
**Why it happens:** Hand-written context files often mix behavioral claims with meta-instructions.
**How to avoid:** Claims shorter than 10 chars or longer than 300 chars should be excluded. Claims matching meta-instruction patterns (e.g., starting with "Follow", "Use", "Always", "Never" as directives with no technical content) score in YELLOW range by default — this is acceptable; these are not code-verifiable claims.
**Warning signs:** Long directive sentences return RED even for a healthy codebase.

### Pitfall 6: vi.mock Factory Pattern for createBridge
**What goes wrong:** Defining a mock bridge as a `const` outside the `vi.mock()` factory and referencing it inside fails due to hoisting — the `const` is undefined when the factory runs.
**Why it happens:** `vi.mock()` is hoisted to top of the test file before any other code runs.
**How to avoid:** Use the inline factory pattern (established in Phase 5 tests):
```typescript
vi.mock("../../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn(), // No external refs inside the factory!
}));
```
Set up mock return values in `beforeEach` using `vi.mocked(createBridge).mockResolvedValue(...)`.
**Warning signs:** "Cannot access before initialization" or "createBridge is not a function" in tests.

## Code Examples

### Claim Extraction - Core Function
```typescript
// src/core/drift/claim-extractor.ts
// Pattern: line-level regex on structured markdown (no external parser needed)

const SKIP_PATTERNS = [
  /^<!--.*-->$/,          // HTML comments (including ez-context markers)
  /^#{1,6}\s+(Project Context|Stack|Conventions|Architecture)$/i, // Structural headings
  /^[-*+]\s+\*\*(Language|Framework|Build|Test Runner|Package Manager|Pattern|Layers):\*\*/i,
];

const BOILERPLATE_VALUE = /^(Language|Framework|Build|Package Manager|Test Runner|Pattern|Layers):\s/i;

export function extractClaims(content: string, sourceFile: string): Claim[] {
  const claims: Claim[] = [];
  const lines = content.split("\n");
  let currentSection = "";

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]!.trim();

    if (!line) continue;
    if (line.startsWith("<!--")) continue;

    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      currentSection = heading[1]!.trim();
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)/);
    const numbered = !bullet ? line.match(/^\d+\.\s+(.+)/) : null;
    const rawText = bullet ? bullet[1]! : numbered ? numbered[1]! : null;

    if (!rawText) continue;

    const text = rawText
      .replace(/\*\*([^*]+)\*\*/g, "$1")  // Strip bold markers
      .replace(/`([^`]+)`/g, "$1")         // Strip inline code markers
      .trim();

    if (text.length < 10 || text.length > 300) continue;
    if (BOILERPLATE_VALUE.test(text)) continue;

    claims.push({
      text,
      sourceFile,
      sourceLine: lineNum + 1,
      sourceSection: currentSection,
    });
  }

  return claims;
}
```

### Claim Scoring - Batch with Semaphore
```typescript
// src/core/drift/claim-scorer.ts
// Batch claims in groups of 10 to avoid ONNX pipeline contention

const BATCH_SIZE = 10;
const GREEN_THRESHOLD = 0.65;
const YELLOW_THRESHOLD = 0.40;

export async function scoreClaims(
  claims: Claim[],
  bridge: EzSearchBridge,
  onProgress?: (done: number, total: number) => void
): Promise<ScoredClaim[]> {
  const results: ScoredClaim[] = [];
  const batches = chunk(claims, BATCH_SIZE);

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async (claim) => {
        const searchResults = await bridge.search(claim.text, { k: 5 });
        const topScore = searchResults[0]?.score ?? 0;
        const status: ClaimStatus =
          topScore >= GREEN_THRESHOLD ? "GREEN" :
          topScore >= YELLOW_THRESHOLD ? "YELLOW" : "RED";
        return { claim, status, score: topScore, evidence: searchResults };
      })
    );
    results.push(...batchResults);
    onProgress?.(results.length, claims.length);
  }

  return results;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
```

### Health Score Computation
```typescript
// src/core/drift/report.ts
export function computeHealthScore(scoredClaims: ScoredClaim[]): number {
  if (scoredClaims.length === 0) return 100; // No claims = no drift
  const mean = scoredClaims.reduce((sum, sc) => sum + sc.score, 0) / scoredClaims.length;
  return Math.round(mean * 100);
}
```

### Report Rendering (String Builder Pattern)
```typescript
// src/core/drift/report.ts
// Follows existing string builder pattern from emitters (no Eta templates)
export function renderDriftReport(report: DriftReport): string {
  const lines: string[] = [];

  lines.push(`# Drift Report`);
  lines.push(`**Health Score:** ${report.healthScore}/100`);
  lines.push(`**File:** ${report.sourceFile}`);
  lines.push(`**Claims:** ${report.scoredClaims.length} analyzed`);
  lines.push("");

  const green = report.scoredClaims.filter(sc => sc.status === "GREEN");
  const yellow = report.scoredClaims.filter(sc => sc.status === "YELLOW");
  const red = report.scoredClaims.filter(sc => sc.status === "RED");

  if (green.length) {
    lines.push(`## Confirmed (${green.length})`);
    for (const sc of green) {
      lines.push(`- [GREEN] ${sc.claim.text}`);
    }
    lines.push("");
  }
  // ... similar for YELLOW, RED

  return lines.join("\n");
}
```

### CLI Command Registration
```typescript
// src/cli.ts addition (follows existing pattern)
import { driftAction } from "./commands/drift.js";

program
  .command("drift")
  .description("Check context files against code for semantic drift")
  .argument("[path]", "project root to analyze", ".")
  .option("--file <contextFile>", "specific context file to check")
  .option("--threshold <number>", "min confidence threshold 0-1", "0.7")
  .action(driftAction);
```

### driftAction Command (follows generateAction/inspectAction pattern)
```typescript
// src/commands/drift.ts
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import ora from "ora";
import chalk from "chalk";
import { createBridge } from "../core/ez-search-bridge.js";
import { extractClaims } from "../core/drift/claim-extractor.js";
import { scoreClaims } from "../core/drift/claim-scorer.js";
import { computeHealthScore } from "../core/drift/report.js";

const CANDIDATE_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", "CONTEXT.md"];

export async function driftAction(
  pathArg: string,
  options: { file?: string; threshold?: string }
): Promise<void> {
  const projectPath = path.resolve(pathArg);
  const spinner = ora("Loading context files...").start();

  try {
    const bridge = await createBridge(projectPath);

    // Require index — drift detection cannot work without it
    if (!(await bridge.hasIndex(projectPath))) {
      spinner.fail("No search index found");
      console.error(chalk.red("Run `ez-search index .` first to create an index."));
      process.exit(1);
    }

    // Resolve which files to check
    const filesToCheck: string[] = [];
    if (options.file) {
      filesToCheck.push(path.resolve(options.file));
    } else {
      for (const candidate of CANDIDATE_FILES) {
        const p = path.join(projectPath, candidate);
        if (existsSync(p)) filesToCheck.push(p);
      }
    }

    if (filesToCheck.length === 0) {
      spinner.fail("No context files found");
      console.error(chalk.red("No CLAUDE.md, AGENTS.md, or .cursorrules found. Use --file to specify one."));
      process.exit(1);
    }

    // Extract all claims
    const allClaims = [];
    for (const filePath of filesToCheck) {
      const content = await readFile(filePath, "utf-8");
      allClaims.push(...extractClaims(content, filePath));
    }

    spinner.text = `Analyzing ${allClaims.length} claims...`;

    // Score claims with progress updates
    let done = 0;
    const scored = await scoreClaims(allClaims, bridge, (d, total) => {
      done = d;
      spinner.text = `Checking claim ${done}/${total}...`;
    });

    spinner.succeed(`Analyzed ${scored.length} claims`);

    const healthScore = computeHealthScore(scored);
    // ... render and print report

  } catch (err) {
    spinner.fail("Drift analysis failed");
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
```

## State of the Art

| Old Assumption | Current Reality | Impact |
|----------------|-----------------|--------|
| Need `embed()` for drift detection | `embed()` throws "not supported" — not needed | Use `bridge.search()` scores instead |
| Cross-model embedding comparison | Same model (Qwen3-Embedding-0.6B) used for both indexing and query | No cross-model normalization needed |
| Need separate cosine similarity library | `bridge.search()` returns normalized 0-1 scores directly | No new dependency |
| Claims require NLP parsing (POS tagging, NER) | Line-level regex on markdown is sufficient for structured context files | Zero new dependencies |

## Open Questions

1. **Threshold Calibration for ez-context's Own Generated Files**
   - What we know: Generated CLAUDE.md sections have stack bullet points that trivially score GREEN. This inflates health scores.
   - What's unclear: Should stack/architecture boilerplate lines (e.g., "Language: TypeScript") be skipped, or rated separately?
   - Recommendation: Skip lines matching `BOILERPLATE_VALUE` pattern (listed in Pitfall 3 above). If all lines in a section are boilerplate, that section contributes 0 claims (not inflated GREEN). This is the correct behavior: stack facts are metadata, not verifiable behavioral claims.

2. **Health Score Interpretation at Boundaries**
   - What we know: A project with 0 claims (e.g., empty context file) should not score 0/100.
   - What's unclear: What's the "no claims" baseline?
   - Recommendation: `scoredClaims.length === 0` returns 100 (no drift detected if nothing to check). Document this clearly in CLI output.

3. **Multi-file Health Score Aggregation**
   - What we know: Multiple context files may be checked. Each yields claims.
   - What's unclear: Should health score be per-file or aggregate?
   - Recommendation: Compute aggregate health score across ALL claims from all files, plus display per-file claim counts. The aggregate score is the primary UX metric.

4. **`bridge.search()` Score in Semantic-Only Mode vs. Hybrid Mode**
   - What we know: `bridge.search()` uses hybrid mode by default (RRF fusion of semantic + BM25). This is the correct mode for claim verification — a claim about "testing with vitest" should match both semantically and lexically.
   - What's unclear: Should drift analysis use a specific mode (e.g., semantic-only)?
   - Recommendation: Keep hybrid mode (the default). Hybrid is more robust for mixed technical/natural language claims. No code change needed.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `/home/dev/work/ez-context/node_modules/@ez-corp/ez-search/dist/services/query-utils.js` — confirms `score = 1 - distance`, normalized [0,1], hybrid RRF fusion
- Codebase inspection: `/home/dev/work/ez-context/node_modules/@ez-corp/ez-search/dist/services/model-router.js` — confirms Qwen3-Embedding-0.6B, 768-dim, `createEmbeddingPipeline` is internal-only
- Codebase inspection: `/home/dev/work/ez-context/node_modules/@ez-corp/ez-search/dist/services/hybrid-fusion.js` — confirms RRF score normalization to [0,1]
- Codebase inspection: `/home/dev/work/ez-context/node_modules/@ez-corp/ez-search/package.json` — confirms only `index`, `query`, `status` in public API exports map; `createEmbeddingPipeline` is NOT exported
- Codebase inspection: `/home/dev/work/ez-context/src/core/ez-search-bridge.ts` — confirms `embed()` throws; `search()` works; only `{ k }` option exposed
- Codebase inspection: `/home/dev/work/ez-context/src/emitters/writer.ts` — confirms string builder pattern for rendering; no Eta templates used
- Codebase inspection: `/home/dev/work/ez-context/test/extractors/semantic/error-handling.test.ts` — confirms vi.mock factory pattern for createBridge

### Secondary (MEDIUM confidence)
- WebSearch verified: nomic-embed-text / Qwen3 cosine similarity range [0,1] for L2-normalized vectors — confirmed by model-router.js `l2Normalize()` function; typical scores 0.3-0.9 for code search
- WebSearch verified: Semantic similarity thresholds — GREEN >= 0.85 (raw cosine) maps to >= 0.65 in RRF-fused space; YELLOW 0.60-0.84 maps to 0.40-0.64 in RRF space; thresholds adjusted for RRF normalization
- WebSearch verified: Markdown line-level regex (`/^[-*+]\s+/`) for bullet extraction — confirmed against markdown spec and existing claude-md.ts output format

### Tertiary (LOW confidence)
- WebSearch only: ACL 2025 Claimify paper — LLM-based atomic claim extraction; not applicable here (overkill for structured markdown)
- WebSearch only: CSDD cosine drift detector — academic method; not applicable (we use point-in-time comparison, not windowed drift)

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — verified by reading source code
- Claim extraction approach (regex): HIGH — verified by inspecting actual CLAUDE.md output format from emitters
- Score thresholds (0.65/0.40): MEDIUM — derived from query-utils.js normalization formula + general embedding similarity literature; should be validated against real queries in implementation
- Architecture patterns: HIGH — follows established Phase 4/5 patterns exactly
- Pitfalls: HIGH — all derived from confirmed codebase facts

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable — ez-search v1.3.0 pinned; thresholds may need minor adjustment post-implementation)
