# Phase 7: Update Command - Research

**Researched:** 2026-02-28
**Domain:** Targeted file update with marker-aware splicing, backup creation, drift-driven regeneration
**Confidence:** HIGH

## Summary

Phase 7 builds `ez-context update` — a command that selectively re-extracts and re-renders only the drifted sections of context files, preserving manual edits outside `<!-- ez-context -->` markers. All building blocks are already in place: the drift detection pipeline (Phase 6), the extraction pipeline (Phase 3/pipeline.ts), the emitters (Phase 3), and the marker-aware writer (Phase 3/writer.ts).

The core logic is: (1) run drift detection against the target context file, (2) for sections flagged YELLOW or RED, re-run extraction and re-render the corresponding section, (3) splice the updated section between its markers while preserving everything outside. The current `writeWithMarkers` treats the entire file as one marker block; Phase 7 needs marker-aware section identification, but the single-marker guard behavior must be preserved.

The update command is significantly simpler than building a new pipeline — it composes existing pieces with new orchestration logic. No new dependencies are required. The main design decision is whether sections within the marker block are individually addressable or treated as a monolithic re-render of the entire marker block.

**Primary recommendation:** Treat the entire marker block as a single unit. Re-render the complete `<!-- ez-context:start -->...<!-- ez-context:end -->` section when any drift is detected, rather than attempting per-section sub-marker surgery. This is simpler, correct, and matches the existing writer contract. The "targeted" in the requirements means: skip the re-render entirely if no drift exists (don't clobber GREEN files), not that individual bullet points are surgically updated.

## Standard Stack

No new dependencies are needed. All libraries are already installed.

### Core (already in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` | built-in | `copyFile()` for backup, `readFile/writeFile` for updates | Built-in; `copyFile` is atomic and correct for backup use |
| `chalk` | `^5.6.2` | Color-coded terminal output | Already used by all commands |
| `ora` | `^9.3.0` | Spinner while re-generating | Already used by all commands |
| `commander` | `^14.0.3` | `update` sub-command registration | Already used for all commands |
| `@ez-corp/ez-search` | `*` | Drift detection via `bridge.search()` | Already used by drift command |

### No New Dependencies
Phase 7 is pure composition of existing Phase 3 (writer, emitters) + Phase 6 (drift pipeline) infrastructure. Do not install anything new.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended File Structure

```
src/
├── commands/
│   ├── generate.ts           (existing)
│   ├── inspect.ts            (existing)
│   ├── drift.ts              (existing, Phase 6)
│   └── update.ts             (NEW — updateAction for CLI)
├── core/
│   ├── updater.ts            (NEW — targeted regeneration engine)
│   ├── drift/                (existing, Phase 6)
│   ├── pipeline.ts           (existing, unchanged)
│   └── ez-search-bridge.ts   (existing, unchanged)
├── emitters/
│   └── writer.ts             (existing — marker validation added here)
└── cli.ts                    (MODIFIED — add update command)
test/
├── commands/
│   └── cli-update.test.ts    (NEW)
└── core/
    └── updater.test.ts       (NEW)
```

The `core/updater.ts` module isolates the regeneration logic for testability, following the established pattern where commands in `src/commands/` are thin wrappers and logic lives in `src/core/`.

### Pattern 1: Marker Validation Before Any Write

**What:** Before performing any marker-based file update, validate that markers exist and are well-formed (start comes before end, no duplicate markers).

**When to use:** Every time before writing to a file that is supposed to contain markers.

**Validation rules:**
1. If file does not exist: valid (create new)
2. If file exists, no markers: valid (append; this is the single-marker-guard behavior)
3. If file exists, has both markers in correct order (start < end): valid (splice)
4. If file exists, has start but no end (or end but no start): INVALID — abort with warning
5. If file exists, start > end (end before start): INVALID — abort with warning

**Critical distinction:** The existing `writeWithMarkers` in Phase 3 silently appends on unpaired markers (single-marker guard). The update command MUST warn and abort on invalid markers rather than silently appending, because an update to a corrupted file is dangerous. The existing behavior is preserved for the `generate` command flow.

```typescript
// Source: derived from writer.ts inspection (src/emitters/writer.ts)
export interface MarkerValidation {
  valid: boolean;
  mode: "create" | "append" | "splice" | "invalid";
  reason?: string;
  startIdx?: number;
  endIdx?: number;
}

export function validateMarkers(content: string): MarkerValidation {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);

  if (startIdx === -1 && endIdx === -1) {
    return { valid: true, mode: "append" };
  }

  if (startIdx === -1 || endIdx === -1) {
    return {
      valid: false,
      mode: "invalid",
      reason: `Unpaired ez-context marker: ${startIdx === -1 ? "start marker missing" : "end marker missing"}`,
    };
  }

  if (startIdx > endIdx) {
    return {
      valid: false,
      mode: "invalid",
      reason: "End marker appears before start marker — file may be corrupted",
    };
  }

  return { valid: true, mode: "splice", startIdx, endIdx };
}
```

### Pattern 2: Backup Before Write

**What:** Copy the existing file to `<filename>.bak` before any marker-based update. Skip backup if file does not exist.

**When to use:** Always, before calling the update write path.

**Implementation:** Use `node:fs/promises copyFile()` — it is atomic (copy-on-write where OS supports it), does not require reading the file content, and preserves file metadata.

```typescript
// Source: node:fs/promises API (built-in, confirmed available in Bun)
import { copyFile, existsSync } from "node:fs";
import { copyFile as copyFileAsync } from "node:fs/promises";

export async function backupFile(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  const backupPath = filePath + ".bak";
  await copyFileAsync(filePath, backupPath);
  return backupPath;
}
```

**Note:** Backup file is `.bak` suffix (e.g., `CLAUDE.md.bak`). This is a simple, universally understood convention. Do not use timestamps — users expect a predictable backup name to restore from.

### Pattern 3: Targeted Regeneration Engine (core/updater.ts)

**What:** Given a target file (e.g., `CLAUDE.md`) and project path, determine if the file has drifted, and if so, re-extract and re-render the marker section.

**When to use:** Called by `updateAction`, also usable programmatically.

**Decision: Full marker block re-render, not per-section surgery**

The marker block in current CLAUDE.md and AGENTS.md is a single contiguous block (one start/end marker pair). Within this block, there are logical sections (Stack, Conventions, Architecture) rendered by the emitters. Re-rendering the entire block is:
- Correct: the emitters already produce the full block content
- Simple: no need to parse sub-sections within the marker block
- Safe: no risk of leaving stale sub-sections intermixed with fresh ones

The "targeted" semantics are implemented at the file level: if a file scores GREEN (no drift), skip re-rendering that file entirely. If it has any YELLOW/RED claims, re-render the entire marker block for that file.

```typescript
// Source: derived from drift.ts + emitters/index.ts inspection
export interface UpdateResult {
  filePath: string;
  action: "skipped" | "updated" | "aborted";
  reason: string;
  backupPath?: string;
}

export async function updateFile(
  filePath: string,
  projectPath: string,
  bridge: EzSearchBridge,
): Promise<UpdateResult> {
  // 1. Read file
  const content = await readFile(filePath, "utf-8");

  // 2. Validate markers
  const validation = validateMarkers(content);
  if (!validation.valid) {
    return {
      filePath,
      action: "aborted",
      reason: validation.reason ?? "Invalid markers",
    };
  }

  // 3. Extract claims and score drift
  const claims = extractClaims(content, filePath);
  const scored = await scoreClaims(claims, bridge);
  const hasDrift = scored.some((sc) => sc.status !== "GREEN");

  if (!hasDrift) {
    return { filePath, action: "skipped", reason: "No drift detected (all claims GREEN)" };
  }

  // 4. Backup
  const backupPath = await backupFile(filePath);

  // 5. Re-extract from project and re-render
  const registry = await extractConventions(projectPath);
  const fileName = path.basename(filePath).toLowerCase();
  const newContent = fileName.includes("agents") ? renderAgentsMd(registry, 0.7) : renderClaudeMd(registry, 0.7);

  // 6. Write with markers (splice mode — validation already confirmed valid markers)
  await writeWithMarkers(filePath, newContent);

  return { filePath, action: "updated", reason: "Drifted sections re-rendered", backupPath: backupPath ?? undefined };
}
```

### Pattern 4: Update CLI Command (src/commands/update.ts)

**What:** `ez-context update [path] [--file <contextFile>] [--dry-run] [-y]` — update drifted context files.

**When to use:** After code changes, to refresh context files without losing manual edits outside markers.

**Follows the same command shape as drift.ts and generate.ts:**
- `path.resolve(pathArg)` for project root
- `ora` spinner with progress updates
- `bridge.hasIndex()` guard before any analysis
- `process.exit(1)` on errors
- Chalk-colored output

```typescript
// src/commands/update.ts
// Source: pattern from drift.ts and generate.ts inspection
export async function updateAction(
  pathArg: string,
  options: { file?: string; dryRun?: boolean; yes?: boolean }
): Promise<void> {
  const projectPath = path.resolve(pathArg);
  const spinner = ora("Checking for drift...").start();

  try {
    const bridge = await createBridge(projectPath);
    if (!(await bridge.hasIndex(projectPath))) {
      spinner.fail("No search index found");
      console.error(chalk.red("Run 'ez-search index .' first to create an index."));
      process.exit(1);
    }

    // Resolve files to update
    const filePaths = options.file
      ? [path.resolve(projectPath, options.file)]
      : CANDIDATE_FILES.map((n) => path.join(projectPath, n)).filter(existsSync);

    if (filePaths.length === 0) {
      spinner.fail("No context files found");
      process.exit(1);
    }

    // Update each file
    for (const filePath of filePaths) {
      const result = await updateFile(filePath, projectPath, bridge);
      // Print result per file
    }
  } catch (err) {
    spinner.fail("Update failed");
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
```

### Anti-Patterns to Avoid

- **Per-section sub-marker surgery:** Do not attempt to surgically update individual sections within the marker block (e.g., only replace the `## Conventions` bullet list). The emitters produce the full block; re-render the whole block to avoid stale/fresh content mixing.
- **Silently appending on invalid markers:** The generate flow silently appends when markers are unpaired. The update flow MUST abort with a warning. These are different safety contracts.
- **Overwriting backup without warning:** If `CLAUDE.md.bak` already exists, overwrite it (the backup is from the previous run — the current state is what we back up now). Do not accumulate `.bak.bak.bak`.
- **Running full extraction without index check:** `extractConventions` uses semantic extractors that call `bridge.search()`. Guard with `bridge.hasIndex()` first.
- **Omitting `--dry-run` support:** The generate command has `--dry-run`; update should too. In dry-run mode, show what would be updated without writing any files or creating backups.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File backup | Custom copy logic with ReadFile + WriteFile | `fs/promises copyFile()` | Atomic, handles large files, preserves permissions |
| Marker detection | New regex | `MARKER_START`/`MARKER_END` constants + `indexOf()` from writer.ts | Already defined in `src/emitters/writer.ts`; import them |
| Drift analysis | Re-implement scoring | Import `extractClaims`, `scoreClaims` from Phase 6 | Already tested and verified in Phase 6 |
| Content generation | Re-implement rendering | Import `renderClaudeMd`, `renderAgentsMd` from Phase 3 emitters | Already produces the exact content needed |
| File splicing | Custom string surgery | `writeWithMarkers()` from Phase 3 writer | Already handles the splice case correctly |
| Progress reporting | Custom progress tracker | `ora` spinner text updates (same as drift.ts pattern) | Already installed and used by all commands |

**Key insight:** Phase 7 is purely orchestration. Every technical component exists. The new code is: `validateMarkers()`, `backupFile()`, `updateFile()`, and the `updateAction` CLI wrapper. That is it.

## Common Pitfalls

### Pitfall 1: Validation vs. Silent Guard Confusion
**What goes wrong:** Developer imports `writeWithMarkers()` from writer.ts and uses it for the update flow, expecting it to abort on invalid markers — but it silently appends instead.
**Why it happens:** The existing single-marker guard in `writeWithMarkers` was a deliberate Phase 3 decision for `generate`: append rather than corrupt. The update command has a different safety contract.
**How to avoid:** The update path uses a NEW validation step (`validateMarkers()`) BEFORE calling `writeWithMarkers()`. If validation fails, abort before touching the file. `writeWithMarkers` itself is unchanged — the guard is in the caller.
**Warning signs:** Tests show that a file with only `<!-- ez-context:start -->` gets its new section appended rather than an error message.

### Pitfall 2: Backup Created Even When Aborting
**What goes wrong:** Code creates backup, then aborts due to invalid markers — leaving a `.bak` file that is identical to the original, confusing users.
**Why it happens:** Backup is created before validation in a naive implementation.
**How to avoid:** Order is: (1) read file, (2) validate markers, (3) check for drift, (4) backup ONLY IF we are going to write. Never backup if aborting.

### Pitfall 3: Re-rendering with Wrong Emitter for the Target File
**What goes wrong:** `AGENTS.md` gets updated with `renderClaudeMd()` content (or vice versa) because the wrong emitter is called.
**Why it happens:** The update engine needs to map file name to emitter function.
**How to avoid:** Use `path.basename(filePath).toLowerCase()` to detect which emitter to call:
- Contains "agents" → `renderAgentsMd()`
- Otherwise → `renderClaudeMd()`
This matches the existing `emit()` function in `src/emitters/index.ts` which hardcodes `CLAUDE.md` and `AGENTS.md`.

### Pitfall 4: extractConventions Is Slow — Run Once, Not Per File
**What goes wrong:** Calling `extractConventions(projectPath)` once per file when updating multiple files (CLAUDE.md + AGENTS.md). Each call runs all 11 extractors.
**Why it happens:** Naive per-file update loop.
**How to avoid:** Call `extractConventions(projectPath)` ONCE, cache the registry, then call `renderClaudeMd(registry, threshold)` and `renderAgentsMd(registry, threshold)` per file using the same registry. This is how the existing `emit()` function works.

### Pitfall 5: vi.mock Hoisting Breaks if Core Module Is Imported at Top Level
**What goes wrong:** Test file imports `updateFile` (which transitively imports `bridge`, `extractClaims`, etc.) before `vi.mock` declarations are processed — causing real implementations to run.
**Why it happens:** ESM + vi.mock hoisting requires that mock declarations appear before any import that transitively depends on the mocked module.
**How to avoid:** Follow the established Phase 6 test pattern exactly: declare all `vi.mock()` factories at the top of the test file, then import the module under test after. See `test/commands/cli-drift.test.ts` for the canonical pattern.

### Pitfall 6: Dry-Run Without Backup Confuses Users
**What goes wrong:** In dry-run mode, the spinner says "Would update CLAUDE.md" but also creates `CLAUDE.md.bak`. User is confused about what happened.
**Why it happens:** Backup creation is not gated on the dry-run flag.
**How to avoid:** In dry-run mode: no file writes, no backup creation. Only print what WOULD happen: which files have drift and what the re-rendered content would look like (preview).

## Code Examples

### Marker Validation Function
```typescript
// src/emitters/writer.ts (or new src/core/updater.ts)
// Source: derived from writeWithMarkers inspection
import { MARKER_START, MARKER_END } from "../emitters/writer.js";

export interface MarkerValidation {
  valid: boolean;
  mode: "create" | "append" | "splice" | "invalid";
  reason?: string;
  startIdx?: number;
  endIdx?: number;
}

export function validateMarkers(content: string): MarkerValidation {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);

  // No markers at all: append mode (safe, matches Phase 3 single-marker guard)
  if (startIdx === -1 && endIdx === -1) {
    return { valid: true, mode: "append" };
  }

  // Unpaired marker: invalid for update (abort with warning)
  if (startIdx === -1 || endIdx === -1) {
    return {
      valid: false,
      mode: "invalid",
      reason: `Unpaired ez-context marker: ${startIdx === -1 ? "start" : "end"} marker missing`,
    };
  }

  // End before start: corrupted
  if (startIdx > endIdx) {
    return {
      valid: false,
      mode: "invalid",
      reason: "End marker appears before start marker (corrupted file)",
    };
  }

  return { valid: true, mode: "splice", startIdx, endIdx };
}
```

### Backup File Function
```typescript
// src/core/updater.ts
// Source: node:fs/promises API (built-in)
import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";

export async function backupFile(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) return null;
  const backupPath = filePath + ".bak";
  await copyFile(filePath, backupPath);
  return backupPath;
}
```

### Core Update Engine
```typescript
// src/core/updater.ts
// Source: pattern from Phase 3 (emitters/index.ts emit()) and Phase 6 (drift/claim-scorer.ts)
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { validateMarkers, backupFile } from "./updater.js";
import { writeWithMarkers } from "../emitters/writer.js";
import { renderClaudeMd } from "../emitters/claude-md.js";
import { renderAgentsMd } from "../emitters/agents-md.js";
import { extractConventions } from "./pipeline.js";
import { extractClaims } from "./drift/claim-extractor.js";
import { scoreClaims } from "./drift/claim-scorer.js";
import type { EzSearchBridge } from "./ez-search-bridge.js";
import type { ConventionRegistry } from "./schema.js";

export type UpdateAction = "skipped" | "updated" | "aborted";

export interface FileUpdateResult {
  filePath: string;
  action: UpdateAction;
  reason: string;
  backupPath?: string;
}

export async function updateFile(
  filePath: string,
  registry: ConventionRegistry,   // Pre-computed registry (call extractConventions once outside)
  bridge: EzSearchBridge,
  confidenceThreshold = 0.7,
): Promise<FileUpdateResult> {
  if (!existsSync(filePath)) {
    return { filePath, action: "skipped", reason: "File does not exist" };
  }

  // 1. Read and validate
  const content = await readFile(filePath, "utf-8");
  const validation = validateMarkers(content);

  if (!validation.valid) {
    return {
      filePath,
      action: "aborted",
      reason: `Marker validation failed: ${validation.reason}`,
    };
  }

  // 2. Check for drift (only if file has markers — no point scoring a file with no generated section)
  if (validation.mode === "splice") {
    const claims = extractClaims(content, filePath);
    if (claims.length > 0) {
      const scored = await scoreClaims(claims, bridge);
      const hasDrift = scored.some((sc) => sc.status !== "GREEN");
      if (!hasDrift) {
        return { filePath, action: "skipped", reason: "No drift detected" };
      }
    }
  }

  // 3. Backup
  const backupPath = await backupFile(filePath);

  // 4. Render new content using appropriate emitter
  const basename = path.basename(filePath).toLowerCase();
  const newContent = basename.includes("agents")
    ? renderAgentsMd(registry, confidenceThreshold)
    : renderClaudeMd(registry, confidenceThreshold);

  // 5. Write (splice if markers exist, append if no markers)
  await writeWithMarkers(filePath, newContent);

  return {
    filePath,
    action: "updated",
    reason: "Re-rendered drifted sections",
    backupPath: backupPath ?? undefined,
  };
}
```

### CLI Command Registration (src/cli.ts addition)
```typescript
// Source: pattern from cli.ts inspection
import { updateAction } from "./commands/update.js";

program
  .command("update")
  .description("Update drifted sections in context files, preserving manual edits")
  .argument("[path]", "project root to analyze", ".")
  .option("--file <contextFile>", "specific context file to update")
  .option("--dry-run", "preview changes without writing files")
  .option("-y, --yes", "non-interactive mode")
  .action(updateAction);
```

### Test Pattern for updateAction (follows cli-drift.test.ts pattern)
```typescript
// test/commands/cli-update.test.ts
// vi.mock factories BEFORE all imports (hoisting requirement)

vi.mock("../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn(),
}));

vi.mock("../../src/core/updater.js", () => ({
  updateFile: vi.fn(),
}));

vi.mock("../../src/core/pipeline.js", () => ({
  extractConventions: vi.fn(),
}));

vi.mock("ora", () => ({
  default: vi.fn(() => mockSpinner),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

// Import AFTER mocks
import { updateAction } from "../../src/commands/update.js";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full file overwrite on regenerate | Marker-aware splice (writeWithMarkers) | Phase 3 | Manual edits outside markers are preserved |
| Always overwrite even if no drift | Drift-check before write | Phase 7 (new) | GREEN files are never modified |
| No file backup | `.bak` backup before update | Phase 7 (new) | Users can recover from bad updates |
| Silent append on invalid markers | Abort with warning for update command | Phase 7 (new) | Prevents silent corruption on update |

**Deprecated/outdated:**
- Nothing from prior phases changes; Phase 7 only adds new orchestration on top.

## Open Questions

1. **Confidence threshold for update command**
   - What we know: generate uses `--threshold 0.7`; drift uses no threshold (all claims extracted)
   - What's unclear: Should `update` expose `--threshold` to control which conventions are re-rendered?
   - Recommendation: Include `--threshold <number>` with default `0.7` (same as generate). Keep parity with generate since update re-renders using the same emitters.

2. **What to do when ALL files are up-to-date (no drift)**
   - What we know: The command may be run proactively; all files may be GREEN
   - What's unclear: Should the command exit 0 with "nothing to do" message, or exit 1 to signal "no update occurred"?
   - Recommendation: Exit 0 with a "All context files are up to date" message. This is the success case — no drift = healthy.

3. **Whether `--file` should update a single file or all CANDIDATE_FILES when omitted**
   - What we know: drift command auto-detects CLAUDE.md, AGENTS.md, .cursorrules, CONTEXT.md; update should match
   - What's unclear: Should update attempt to update files it did not originally generate (e.g., `.cursorrules`)?
   - Recommendation: Update only `CLAUDE.md` and `AGENTS.md` by default (the files ez-context generates). Use `--file` to update other files. This prevents accidentally clobbering hand-written `.cursorrules` files.

4. **Backup file naming when `.bak` already exists**
   - What we know: `copyFile(src, dest)` overwrites existing destination silently
   - What's unclear: Should previous backup be preserved?
   - Recommendation: Overwrite the `.bak` file. The backup represents "the state before this update run." Accumulating timestamped backups adds complexity with minimal benefit.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `/home/dev/work/ez-context/src/emitters/writer.ts` — confirms `MARKER_START`, `MARKER_END` constants, `writeWithMarkers()` API, single-marker guard behavior
- Codebase inspection: `/home/dev/work/ez-context/src/emitters/index.ts` — confirms `emit()` calls `extractConventions` once and renders both files; this is the pattern to follow
- Codebase inspection: `/home/dev/work/ez-context/src/commands/drift.ts` — confirms command shape, spinner pattern, `hasIndex()` guard, error handling pattern
- Codebase inspection: `/home/dev/work/ez-context/src/core/pipeline.ts` — confirms `extractConventions(projectPath)` API
- Codebase inspection: `/home/dev/work/ez-context/src/core/drift/claim-extractor.ts` — confirms `extractClaims(content, filePath)` API
- Codebase inspection: `/home/dev/work/ez-context/src/core/drift/claim-scorer.ts` — confirms `scoreClaims(claims, bridge, onProgress?)` API
- Codebase inspection: `/home/dev/work/ez-context/test/commands/cli-drift.test.ts` — confirms vi.mock hoisting pattern for ESM tests
- Codebase inspection: `/home/dev/work/ez-context/package.json` — confirms Bun, Vitest, no new dependencies needed
- Node.js built-in: `fs/promises.copyFile()` confirmed available in Bun runtime via direct inspection

### Secondary (MEDIUM confidence)
- Established codebase convention: `.bak` suffix for backup files (universally understood, no competing standard in this codebase)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — confirmed by reading all relevant source files; all needed APIs exist
- Architecture patterns: HIGH — Phase 7 is composition of existing verified modules; no novel engineering required
- Marker validation logic: HIGH — derived directly from writer.ts behavior + Phase 3 single-marker guard decision
- Backup strategy: HIGH — `fs/promises copyFile()` confirmed available, `.bak` convention is clear
- Pitfalls: HIGH — all derived from reading actual code; not speculative

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (stable — no external dependencies changing; internal codebase is under development control)
