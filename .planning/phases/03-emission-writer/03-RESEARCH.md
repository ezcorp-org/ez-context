# Phase 3: Emission + Writer - Research

**Researched:** 2026-02-28
**Domain:** Template rendering, markdown file generation, marker-based file updates
**Confidence:** HIGH

## Summary

Phase 3 takes the `ConventionRegistry` produced by Phase 2 and renders it into two output files: `CLAUDE.md` and `AGENTS.md`. The plan calls for the Eta template engine for rendering, HTML comment markers for update-safe sections, and minimal output strategy backed by research showing bloated context degrades agent performance.

The standard approach is: Eta v4 (`renderString` API for in-memory templates) + Node `fs/promises` for file I/O + a custom marker-aware splice function for update-safe writes. No heavy framework is needed — the entire emitter is thin logic on top of these three pieces.

The Eta choice is well-suited: it is zero-dependency, TypeScript-native, supports ESM, works with string templates (no disk template files required), and is used at scale by projects like Docusaurus and swagger-typescript-api. The current version is 4.5.1.

AGENTS.md structure is now governed by the Agentic AI Foundation (Linux Foundation) but deliberately has no rigid schema — only recommended sections. Six areas are universally recommended: commands, testing, project structure, code style, git workflow, and boundaries. The file must be concise (under 150 lines) to avoid context rot.

**Primary recommendation:** Use `eta.renderString(template, data)` with inline template literals (no views directory, no file system for templates). Implement marker-aware file writer as a pure function that reads, splices, and writes. Keep generated output aggressively minimal — research confirms that LLM-generated context files decrease agent performance when bloated.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| eta | ^4.5.1 | Template rendering | Zero deps, TypeScript-native, ESM, `renderString` API for in-memory use |
| node:fs/promises | built-in | File read/write | No extra dep needed; `readFile`/`writeFile` with UTF-8 |
| node:path | built-in | Path resolution | Needed for output file path construction |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none beyond core) | — | — | The marker-splice logic is simple enough to hand-roll as a pure function (~30 lines) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| eta | Handlebars | Heavier, requires separate @types, not as clean for TypeScript |
| eta | EJS | Older project, eta is a direct drop-in that is faster and lighter |
| eta | Template literals only | No caching, no partials, no whitespace control — fine for small templates but eta adds zero overhead and provides escape safety |
| eta renderString | eta file-based render | File-based adds complexity (views directory, file lookups); in-memory is simpler since templates live in TypeScript source |

**Installation:**
```bash
bun add eta
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── emitters/
│   ├── index.ts           # public API: emit(registry, options)
│   ├── types.ts           # EmitOptions, EmitResult interfaces
│   ├── claude-md.ts       # renderClaudeMd(registry): string
│   ├── agents-md.ts       # renderAgentsMd(registry): string
│   └── writer.ts          # writeWithMarkers(path, sectionId, content): Promise<void>
├── core/                  # (existing from Phase 2)
└── extractors/            # (existing from Phase 2)
```

### Pattern 1: In-Memory Template Rendering with Eta

**What:** Instantiate `new Eta()` once (no views directory), call `renderString(template, data)` with template as a TypeScript string constant.

**When to use:** All rendering in this phase — templates live in source code, not on disk.

**Example:**
```typescript
// Source: https://eta.js.org / verified API pattern
import { Eta } from "eta";

const eta = new Eta();

// Use <%~ for raw/unescaped output (needed for markdown content)
// Use <%= for HTML-escaped output (NOT what we want for markdown)
const CLAUDE_MD_TEMPLATE = `\
# Project Context

## Stack
<% for (const entry of it.stackEntries) { %>
- <%~ entry %>
<% } %>

## Conventions
<% for (const c of it.conventions) { %>
- **<%~ c.category %>**: <%~ c.pattern %>
<% } %>
`;

export function renderClaudeMd(registry: ConventionRegistry): string {
  const result = eta.renderString(CLAUDE_MD_TEMPLATE, {
    stackEntries: buildStackEntries(registry.stack),
    conventions: registry.conventions.filter(c => c.confidence >= 0.7),
  });
  // renderString returns string | void in types; assert non-null
  if (result == null) throw new Error("eta.renderString returned void");
  return result;
}
```

**Critical detail:** Use `<%~` (raw/unescaped) NOT `<%=` (HTML-escaped) for all markdown content. The `=` prefix applies XML escaping which will corrupt markdown.

### Pattern 2: Marker-Aware File Writer

**What:** Read existing file, find marker boundaries, replace only the auto-generated section, preserve everything outside markers.

**When to use:** All output file writes — enables future `update` command and preserves manual edits.

**Example:**
```typescript
// Source: Architecture.md design + verified pattern from tsdoc-markdown ecosystem
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const MARKER_START = "<!-- ez-context:start -->";
const MARKER_END = "<!-- ez-context:end -->";

/**
 * Write content into the marker section of filePath.
 * If the file does not exist, creates it with the markers wrapping content.
 * If the file exists but has no markers, appends the section at the end.
 * Content between existing markers is fully replaced.
 */
export async function writeWithMarkers(
  filePath: string,
  content: string
): Promise<void> {
  const section = `${MARKER_START}\n${content}\n${MARKER_END}`;

  if (!existsSync(filePath)) {
    await writeFile(filePath, section + "\n", "utf-8");
    return;
  }

  const existing = await readFile(filePath, "utf-8");
  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);

  if (startIdx === -1 || endIdx === -1) {
    // No markers present — append section
    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    await writeFile(filePath, existing + separator + section + "\n", "utf-8");
    return;
  }

  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + MARKER_END.length);
  await writeFile(filePath, before + section + after, "utf-8");
}
```

### Pattern 3: Minimal Output Strategy

**What:** Filter and transform `ConventionRegistry` data before templating to produce only agent-non-discoverable conventions.

**When to use:** Both CLAUDE.md and AGENTS.md emitters. Research confirms bloated context hurts agent performance.

**Rules for what to include:**
- Include: naming conventions that deviate from language defaults (e.g., unusual casing)
- Include: non-obvious tooling choices (e.g., bun instead of npm, tsdown instead of tsc)
- Include: architectural patterns that aren't obvious from folder structure
- Include: security/safety constraints (never touch X, always do Y)
- Exclude: framework name if obvious from package.json (agent will read that)
- Exclude: test runner if standard for the language
- Exclude: any convention with confidence < 0.7
- Exclude: anything an agent can infer from existing config files

### AGENTS.md Recommended Sections (Linux Foundation / AAIF)

No rigid schema required. The 6 areas that matter most (per GitHub analysis of 2,500+ repos):

1. **Commands** — exact commands for build, test, lint, typecheck
2. **Testing** — how to run single tests, test file patterns
3. **Project Structure** — non-obvious directory layout
4. **Code Style** — conventions that differ from defaults (with code examples)
5. **Git Workflow** — branch naming, commit conventions
6. **Boundaries** — what the agent must never touch

**Critical:** Keep under 150 lines. AGENTS.md goes into every agent context window.

### Anti-Patterns to Avoid

- **Using `<%=` for markdown output:** Applies XML escaping; corrupts hyphens, angle brackets, and backticks in markdown. Always use `<%~` for raw output.
- **Generating verbose context:** Research shows LLM-generated context files decrease agent performance when bloated. Be aggressively minimal.
- **Duplicating package.json info:** Agents read package.json. Don't restate dependencies or scripts.
- **Creating a views directory for templates:** Template strings in TypeScript source are simpler and don't require filesystem access.
- **Returning `void` from renderString:** Eta's TypeScript types return `string | void`. Always check for null/undefined.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template syntax parsing | Custom string interpolation | eta `renderString` | Eta handles loops, conditionals, whitespace control, and raw output; custom interpolation misses edge cases |
| HTML/XML escaping | Custom escape function | eta's built-in (but use `<%~` to bypass for markdown) | Eta's escape is battle-tested; for markdown, bypass intentionally |

**Key insight:** The marker-based file splice is genuinely simple (one `indexOf` + `slice` pattern) and does not need a library. The only real dependency is eta for template rendering.

## Common Pitfalls

### Pitfall 1: HTML-escaped output breaks markdown

**What goes wrong:** Using `<%= it.value %>` instead of `<%~ it.value %>` causes Eta to HTML-escape the output. Markdown content like `` `code` ``, `**bold**`, and `- list item` gets corrupted into `&#96;code&#96;`, `**bold**`, etc.

**Why it happens:** Eta defaults to auto-escaping (like EJS) to prevent XSS in HTML contexts. Markdown is not HTML.

**How to avoid:** Use `<%~` for all markdown content. Alternatively set `autoEscape: false` on the Eta instance: `new Eta({ autoEscape: false })`.

**Warning signs:** Generated file contains `&lt;`, `&gt;`, `&#96;`, or `&amp;` characters.

### Pitfall 2: renderString returns void in some Eta versions

**What goes wrong:** `eta.renderString(...)` is typed as `string | void`. Passing this directly into string concatenation produces `"undefined"` in the output file.

**Why it happens:** Eta uses `void` return for async template rendering that hasn't resolved. Synchronous rendering always returns `string`, but the TypeScript type is a union.

**How to avoid:** Always assert: `const result = eta.renderString(t, d); if (result == null) throw new Error("...");`

### Pitfall 3: Marker corruption on concurrent writes

**What goes wrong:** If `writeWithMarkers` is called twice concurrently on the same file, a race condition corrupts the markers (second read sees stale content, second write overwrites first write's changes).

**Why it happens:** File read-modify-write is not atomic.

**How to avoid:** In Phase 3, the emitter always writes CLAUDE.md and AGENTS.md sequentially or in parallel to different files (not the same file). For the `update` command in a later phase, use a file lock or sequential queue. For Phase 3: `await Promise.all([writeClaudeMd(...), writeAgentsMd(...)])` is safe since they write different files.

### Pitfall 4: Empty registry sections produce ugly output

**What goes wrong:** `registry.architecture.layers` may be empty `[]`. Template loop produces empty section with only the heading.

**Why it happens:** Not all extractors populate all fields. Some projects have no detectable architecture layers.

**How to avoid:** Add guards in template data construction: only include sections when they have content. Use `it.conventions.length > 0` checks before rendering sections.

### Pitfall 5: Confidence threshold too low includes noise

**What goes wrong:** Low-confidence conventions (0.3–0.5) from extractors create misleading entries in generated files. E.g., a naming convention observed in 2 files gets emitted as if it's project-wide.

**Why it happens:** Extractors produce entries at varying confidence levels.

**How to avoid:** Filter `registry.conventions` to `confidence >= 0.7` before passing to templates. This is the aggressively minimal strategy required by GEN-07.

## Code Examples

Verified patterns from official sources and the codebase context:

### Eta instantiation and renderString (no files)
```typescript
// Source: https://eta.js.org (Eta v4 API)
import { Eta } from "eta";

// For markdown generation: disable auto-escaping OR use <%~ everywhere
const eta = new Eta({ autoEscape: false });

const template = `\
# <%= it.title %>

<% if (it.commands.length > 0) { %>
## Commands
<% for (const cmd of it.commands) { %>
- `<%= cmd.description %>`: `<%= cmd.command %>`
<% } %>
<% } %>
`;

const output = eta.renderString(template, { title: "My Project", commands: [...] });
```

### Marker-based file writer (complete)
```typescript
// Source: ARCHITECTURE.md spec + standard splice pattern
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export const MARKER_START = "<!-- ez-context:start -->";
export const MARKER_END = "<!-- ez-context:end -->";

export async function writeWithMarkers(
  filePath: string,
  newContent: string
): Promise<void> {
  const wrapped = `${MARKER_START}\n${newContent}\n${MARKER_END}`;

  if (!existsSync(filePath)) {
    await writeFile(filePath, wrapped + "\n", "utf-8");
    return;
  }

  const existing = await readFile(filePath, "utf-8");
  const start = existing.indexOf(MARKER_START);
  const end = existing.indexOf(MARKER_END);

  if (start === -1 || end === -1) {
    const sep = existing.endsWith("\n") ? "\n" : "\n\n";
    await writeFile(filePath, existing + sep + wrapped + "\n", "utf-8");
    return;
  }

  const before = existing.slice(0, start);
  const after = existing.slice(end + MARKER_END.length);
  await writeFile(filePath, before + wrapped + after, "utf-8");
}
```

### Emitter public API shape
```typescript
// Recommended interface for src/emitters/index.ts
export interface EmitOptions {
  outputDir: string;          // where to write CLAUDE.md and AGENTS.md
  confidenceThreshold?: number; // default 0.7
  dryRun?: boolean;           // return content without writing
}

export interface EmitResult {
  claudeMd: string;           // rendered content
  agentsMd: string;           // rendered content
  filesWritten: string[];     // absolute paths written
}

export async function emit(
  registry: ConventionRegistry,
  options: EmitOptions
): Promise<EmitResult>
```

### Filtering conventions for minimal output
```typescript
// In emitter data-prep layer
function buildEmitData(registry: ConventionRegistry, threshold: number) {
  const conventions = registry.conventions
    .filter(c => c.confidence >= threshold)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    stack: registry.stack,
    conventions,
    architecture: registry.architecture,
    hasConventions: conventions.length > 0,
    hasLayers: registry.architecture.layers.length > 0,
    hasBuildTool: !!registry.stack.buildTool,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EJS templates | Eta (EJS successor) | ~2020 | Smaller, faster, TypeScript-native, better error messages |
| eta v2 `render()` for strings | eta v3/v4 `renderString()` | v3.0.0 (2023) | Explicit separation of file-based vs string-based rendering |
| AGENTS.md as informal convention | AGENTS.md as Linux Foundation / AAIF standard | December 2025 | Now officially governed; 60,000+ projects adopted |
| Long verbose context files | Aggressively minimal context | 2025 research | LLM-generated context files decrease agent performance when bloated |

**Deprecated/outdated:**
- `eta.render(templateString, data)` for string rendering: In v3+, `render()` is for named templates only. Use `renderString()` for string templates.
- Multiple views directories: v3 simplified to single views directory. Irrelevant since we use no views directory.

## Open Questions

1. **Template embedding strategy: inline strings vs. separate .eta files**
   - What we know: `renderString` works with inline TypeScript string constants; this is simpler for Phase 3 since templates are small and there are only two output formats
   - What's unclear: As more output formats are added later (`.mdc`, Cursor rules), separate template files may be easier to maintain
   - Recommendation: Start with inline string constants in the emitter source files. This avoids the views directory complexity and keeps everything type-safe. Refactor to file-based templates only if the number of templates grows beyond ~5.

2. **How minimal is "aggressively minimal" for CLAUDE.md?**
   - What we know: Research shows LLM-generated context hurts when bloated; under 200 lines is the consensus; agents read `package.json`, `tsconfig.json`, `README.md` themselves
   - What's unclear: Exact threshold for what's "discoverable" vs what needs explicit documentation
   - Recommendation: Default confidence threshold of 0.7; omit anything the agent can get from standard config files (framework name, test runner, language); include only naming deviations, unusual tooling choices, non-obvious architectural patterns, and explicit boundaries/constraints.

## Sources

### Primary (HIGH confidence)
- Context7 / eta official docs (eta.js.org) — API methods, configuration options, v3/v4 changes
- GitHub bgub/eta repository README — current version 4.5.1, installation, features
- ARCHITECTURE.md in ez-context project — marker format specification (`<!-- ez-context:start -->`)
- Project codebase (src/core/schema.ts, src/core/registry.ts) — ConventionRegistry types

### Secondary (MEDIUM confidence)
- agents.md official site + OpenAI Codex documentation — AGENTS.md format and recommended sections
- GitHub Blog: "How to write a great agents.md: Lessons from over 2,500 repositories" — structure analysis
- Linux Foundation AAIF announcement (December 2025) — AGENTS.md governance transfer

### Tertiary (LOW confidence)
- Various blog posts on CLAUDE.md best practices — consensus under 200 lines, avoid duplicating config file info
- Chroma Research "Context Rot" + JetBrains Research NeurIPS 2025 — bloated context degrades performance (cited in requirements GEN-07 rationale)

## Metadata

**Confidence breakdown:**
- Standard stack (eta v4, fs/promises): HIGH — verified via GitHub repo (v4.5.1 current), official docs
- Architecture (emitter structure, writer pattern): HIGH — derived directly from codebase schema and ARCHITECTURE.md spec
- Pitfalls (escape mode, renderString void): HIGH — verified against Eta v3/v4 API changes
- AGENTS.md structure: HIGH — verified via agents.md official site and OpenAI Codex documentation
- Minimal output strategy: MEDIUM — research findings consistent across multiple sources but specific thresholds are judgment calls

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (eta is actively maintained but API is stable; AGENTS.md standard is now formally governed so unlikely to shift)
