# Phase 8: Additional Formats + Integration - Research

**Researched:** 2026-02-28
**Domain:** Multi-format emitters (Cursor MDC, GitHub Copilot, SKILL.md, Rulesync, Ruler), npm packaging, bun standalone binary
**Confidence:** HIGH

## Summary

Phase 8 has three parallel tracks: (1) new emitter modules for additional output formats, (2) a `--format` flag to dispatch to the right emitter, and (3) distribution packaging as both an npm package and a standalone bun binary.

All three new format groups (Cursor/Copilot/SKILL.md, Rulesync, Ruler) follow the same string-builder emitter pattern already established in Phase 3 (`src/emitters/claude-md.ts`, `src/emitters/agents-md.ts`). No new rendering library is needed. File layout for each format is well-specified and verified against official sources. The `--format` flag integrates into the existing `generate` command's option bag.

For distribution: `package.json` already has `bin`, `name`, and `main` fields correctly set. Only two additions are needed — `publishConfig.access: "public"` for the scoped npm package, and a `bun build --compile` invocation for the standalone binary. The built `dist/cli.js` already has the `#!/usr/bin/env node` shebang from tsdown.

**Primary recommendation:** Implement all emitters as separate files in `src/emitters/`, dispatch via a format-to-emitter registry map, and add `bun build --compile src/cli.ts --outfile dist/ez-context` to the build script. No new npm dependencies are required.

---

## Standard Stack

All libraries are already installed. No new dependencies needed.

### Core (existing in package.json)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` | built-in | `mkdir`, `writeFile` for creating nested dirs | Built-in; `mkdir({ recursive: true })` handles `.cursor/rules/` |
| `js-yaml` | `^4` | Serialize YAML frontmatter for MDC files | Already in package.json; used by extractors |
| `chalk` | `^5.6.2` | Terminal output in generate command | Already used |
| `ora` | `^9.3.0` | Spinner during generation | Already used |

### No New Dependencies
All emitter formats use string building (same pattern as `claude-md.ts`). YAML frontmatter for `.mdc` files uses `js-yaml` which is already installed. Do not install anything new.

**Installation:**
```bash
# No new packages needed
```

---

## Output Format Specifications

### Format: cursor (`--format cursor`)

**Output:** `.cursor/rules/*.mdc` files with YAML frontmatter + Markdown body

**File location:** `{outputDir}/.cursor/rules/ez-context.mdc`

**Exact MDC format (verified from cursor.com/docs):**
```
---
description: Project conventions extracted by ez-context
globs:
alwaysApply: true
---

[markdown content here]
```

**YAML frontmatter fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `description` | string | Yes (recommended) | Shown in Cursor UI |
| `globs` | string | No | File pattern for auto-attach |
| `alwaysApply` | boolean | No | If true, always in context |

**Recommended approach:** Generate a single `ez-context.mdc` with `alwaysApply: true`. This ensures the project context is always present without needing glob matching. The content is the same conventions rendered for CLAUDE.md.

**Directory creation:** Must `mkdir -p .cursor/rules/` before writing.

**js-yaml usage for YAML frontmatter:**
```typescript
import yaml from "js-yaml";
const frontmatter = yaml.dump({ description: "...", globs: "", alwaysApply: true });
const content = `---\n${frontmatter}---\n\n${body}`;
```

Note: `globs` should be an empty string (not null/omitted) based on Cursor's own examples when not used.

---

### Format: copilot (`--format copilot`)

**Output:** `.github/copilot-instructions.md`

**File location:** `{outputDir}/.github/copilot-instructions.md`

**Format:** Plain Markdown, no YAML frontmatter. Natural language instructions covering:
- High-level project overview (what it does, language/framework)
- Build and test commands
- Project layout and key directories
- Coding conventions

**No markers:** The copilot instructions file does NOT use `<!-- ez-context -->` markers. GitHub Copilot reads the entire file. Use `writeWithMarkers` pattern only if the file already exists (to preserve manual additions). If file doesn't exist, write directly.

**Directory creation:** Must `mkdir -p .github/` before writing.

---

### Format: skills (`--format skills`)

**Output:** SKILL.md modules in a skills directory

**File location:** `{outputDir}/.skills/ez-context/SKILL.md`

**Exact SKILL.md format (verified from agentskills.io/specification):**
```yaml
---
name: ez-context
description: Project conventions and coding standards for this codebase. Use when writing new code, reviewing patterns, or understanding project architecture.
---

[markdown body with conventions]
```

**YAML frontmatter fields (verified):**
| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | Max 64 chars, lowercase + hyphens only, must match directory name |
| `description` | Yes | Max 1024 chars, describes what AND when to use |
| `license` | No | License identifier |
| `compatibility` | No | Max 500 chars, environment requirements |
| `metadata` | No | Arbitrary key-value map |

**Directory name MUST match `name` field.** If `name: ez-context`, directory must be `ez-context/`.

**Progressive disclosure tiers:**
1. Metadata (~100 tokens) — name + description loaded at startup for all skills
2. Instructions (<5000 tokens) — full SKILL.md body loaded when activated
3. References — separate files loaded on demand only

**Recommendation:** Generate `{outputDir}/.skills/ez-context/SKILL.md` with `name: ez-context`. Keep the body to a focused summary of the most important conventions (same content as CLAUDE.md but framed as skill instructions, not project context).

---

### Format: rulesync (`--format rulesync`)

**Output:** Rule file in `.rulesync/rules/` directory

**File location:** `{outputDir}/.rulesync/rules/ez-context.md`

**Format:** YAML frontmatter + Markdown body. The `targets` field specifies which tools receive this rule:
```yaml
---
description: Project conventions extracted by ez-context
targets:
  - claudecode
  - cursor
  - geminicli
---

[markdown body with conventions]
```

**Key insight:** ez-context's job is to WRITE INTO the `.rulesync/rules/` directory. Rulesync then reads from that directory and distributes to tool-specific locations. We are a SOURCE for Rulesync, not a consumer. We write one canonical Markdown file; Rulesync handles the per-tool distribution.

**targets field:** Set to `"*"` (all tools) or omit for broad compatibility. Use `writeWithMarkers` pattern for idempotent updates.

---

### Format: ruler (`--format ruler`)

**Output:** Rule file in `.ruler/` directory

**File location:** `{outputDir}/.ruler/ez-context.md`

**Format:** Plain Markdown. Ruler recursively discovers all `.md` files in `.ruler/`, concatenates them alphabetically, and distributes to agent-specific config locations.
```markdown
# Project Conventions (ez-context)

[markdown body with conventions]
```

**Key insight:** Ruler reads the entire `.ruler/` directory contents. We write a single `.ruler/ez-context.md` file. The filename prefix ensures predictable sort order (alphabetical). Use `writeWithMarkers` for idempotent updates so re-running doesn't break manual `.ruler/*.md` files.

**No frontmatter needed** — Ruler uses plain `.md` files, not YAML frontmatter.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── emitters/
│   ├── index.ts              (existing — extend to handle format dispatch)
│   ├── types.ts              (extend EmitOptions with format field, extend EmitResult)
│   ├── writer.ts             (existing — writeWithMarkers, reuse)
│   ├── claude-md.ts          (existing)
│   ├── agents-md.ts          (existing)
│   ├── cursor-mdc.ts         (NEW — renderCursorMdc)
│   ├── copilot-md.ts         (NEW — renderCopilotMd)
│   ├── skill-md.ts           (NEW — renderSkillMd)
│   ├── rulesync-md.ts        (NEW — renderRulesyncMd)
│   └── ruler-md.ts           (NEW — renderRulerMd)
├── commands/
│   └── generate.ts           (extend to accept --format flag)
```

### Pattern 1: Renderer Function (matches existing pattern exactly)

Each new emitter follows the same signature as `claude-md.ts`:
```typescript
// Source: existing src/emitters/claude-md.ts pattern
export function renderCursorMdc(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const lines: string[] = [];
  // YAML frontmatter via js-yaml
  // Then markdown body via lines.push() / join()
  return lines.join("\n") + "\n";
}
```

### Pattern 2: Format Dispatch in emit()

Add a `format` field to `EmitOptions` and dispatch in `emit()`:
```typescript
// Extend EmitOptions
export interface EmitOptions {
  outputDir: string;
  confidenceThreshold?: number;
  dryRun?: boolean;
  formats?: OutputFormat[];  // NEW: list of formats to generate
}

export type OutputFormat = "claude" | "agents" | "cursor" | "copilot" | "skills" | "rulesync" | "ruler";
```

The `emit()` function in `index.ts` maps each requested format to a render function and output path, then calls `writeWithMarkers` (or a direct write for formats that don't support markers).

### Pattern 3: CLI --format Flag

Add `--format` option to the `generate` command in `cli.ts`:
```typescript
// In cli.ts generate command
.option("--format <formats>", "output formats (comma-separated: claude,agents,cursor,copilot,skills,rulesync,ruler)", "claude,agents")
```

Parse comma-separated values in `generateAction`:
```typescript
const formats = (options.format ?? "claude,agents").split(",").map(s => s.trim());
```

### Pattern 4: Directory Creation for Nested Paths

New formats write to nested directories. Use `mkdir` with `recursive: true`:
```typescript
// Source: node:fs/promises docs
import { mkdir, writeFile } from "node:fs/promises";

async function writeToFormat(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}
```

Note: `.cursor/rules/*.mdc`, `.skills/ez-context/SKILL.md`, `.rulesync/rules/*.md` all require parent directory creation.

### Anti-Patterns to Avoid

- **Separate emit() per format:** Don't create a separate top-level emit function per format. Use one `emit()` with a `formats` array parameter.
- **Markers in cursor/skill files:** Do NOT wrap cursor MDC or SKILL.md files with `<!-- ez-context:start/end -->` markers. These formats have their own conventions. Use `writeWithMarkers` only for CLAUDE.md-style files where the tool co-exists with human edits.
- **Hard-coding all formats in the default:** Default should be `claude,agents` (existing behavior) not all formats. Adding new formats changes file layout and users must opt in.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML serialization | Custom frontmatter string concat | `js-yaml` (already installed) | Handles edge cases: special chars, multiline values, proper quoting |
| Directory creation | `existsSync` + `mkdirSync` chain | `mkdir(path, { recursive: true })` | Built-in, atomic, handles nested paths in one call |
| Binary compilation | Custom shell script bundling | `bun build --compile` | First-class Bun feature, bundles runtime + code + assets |

**Key insight:** `js-yaml.dump()` is already in the project for TOML/YAML parsing by extractors. Reuse it for YAML frontmatter serialization in MDC and SKILL.md files.

---

## Common Pitfalls

### Pitfall 1: MDC Frontmatter `globs` Field

**What goes wrong:** Omitting `globs` entirely causes Cursor to treat the rule as "manual" (never auto-applied). Setting `globs: null` produces `globs: null` in YAML which Cursor may reject.

**How to avoid:** Set `globs: ""` (empty string) when not using glob-based attachment. With `alwaysApply: true`, the `globs` field is effectively ignored but must still be present as a string.

**Warning signs:** Rule doesn't appear in Cursor's Rules list, or Cursor silently ignores the file.

---

### Pitfall 2: SKILL.md `name` Field Must Match Directory Name

**What goes wrong:** Writing `name: my-skill` but placing the file in `.skills/my_skill/SKILL.md` fails validation. The directory name must exactly match the `name` field.

**How to avoid:** Derive the directory name from the `name` value, not the other way around. Use `name: ez-context` → directory `ez-context/`.

**Warning signs:** Agent Skills tooling validation fails; `skills-ref validate` reports mismatch.

---

### Pitfall 3: Rulesync vs. Ruler Are INPUTS, Not Consumers

**What goes wrong:** Treating rulesync/ruler as tools that ez-context calls. They are separate tools with their own CLIs.

**How to avoid:** ez-context's job is to WRITE files into `.rulesync/rules/` and `.ruler/` directories. The user then runs `rulesync generate` or `ruler apply` separately. ez-context is a source; rulesync/ruler are distributors.

---

### Pitfall 4: Scoped npm Package Defaults to Private

**What goes wrong:** Publishing `@ez-corp/ez-context` without `publishConfig.access: "public"` results in a 402 error on npm (scoped packages default to `restricted`).

**How to avoid:** Add to `package.json`:
```json
"publishConfig": {
  "access": "public"
}
```

**Warning signs:** `npm publish` exits with 402 Payment Required or "You must sign up for private packages."

---

### Pitfall 5: bun compile vs. bun build (tsdown)

**What goes wrong:** Confusing tsdown's `bun run build` (which produces `dist/cli.js` for npm distribution) with `bun build --compile` (which produces a standalone binary). They serve different purposes.

**How to avoid:**
- `tsdown` → `dist/cli.js` (ESM, requires node, for `npm install -g`)
- `bun build --compile src/cli.ts --outfile dist/ez-context` → standalone binary (no runtime required)

Add a separate `build:binary` script in `package.json`, don't replace the existing `build` script.

---

### Pitfall 6: writeWithMarkers on Format Files That Own Their Entire Content

**What goes wrong:** Using `writeWithMarkers` on `.cursor/rules/ez-context.mdc` wraps the MDC content inside HTML comment markers, which Cursor won't understand.

**How to avoid:** Cursor MDC, SKILL.md, and Ruler `.ruler/ez-context.md` files should be written with a direct `writeFile` (or a format-specific idempotent write). Only CLAUDE.md, AGENTS.md, and copilot-instructions.md use `writeWithMarkers` (files that may co-exist with manual user content).

The copilot instructions file is an edge case: if the file doesn't exist, write the full content. If it exists, use `writeWithMarkers` to manage the ez-context section without destroying user additions.

---

## Code Examples

### Cursor MDC Renderer
```typescript
// Pattern follows src/emitters/claude-md.ts exactly
import yaml from "js-yaml";
import type { ConventionRegistry } from "../core/schema.js";

export function renderCursorMdc(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  // Build YAML frontmatter
  const frontmatter = yaml.dump({
    description: "Project conventions extracted by ez-context",
    globs: "",
    alwaysApply: true,
  }).trimEnd();

  // Build markdown body (reuse same logic as claude-md.ts)
  const body = renderConventionsMarkdown(registry, confidenceThreshold);

  return `---\n${frontmatter}\n---\n\n${body}\n`;
}
```

### SKILL.md Renderer
```typescript
import yaml from "js-yaml";
import type { ConventionRegistry } from "../core/schema.js";

export function renderSkillMd(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const frontmatter = yaml.dump({
    name: "ez-context",
    description:
      "Project conventions and coding standards for this codebase. " +
      "Use when writing new code, reviewing patterns, or understanding project architecture.",
  }).trimEnd();

  const body = renderConventionsMarkdown(registry, confidenceThreshold);

  return `---\n${frontmatter}\n---\n\n${body}\n`;
}
```

### Directory-Creating Writer
```typescript
// For formats that need nested directories
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeFormatFile(
  filePath: string,
  content: string
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}
```

### bun compile Command
```bash
# Produces a self-contained binary at dist/ez-context
bun build --compile --minify src/cli.ts --outfile dist/ez-context
```

Add to `package.json` scripts:
```json
"build:binary": "bun build --compile --minify src/cli.ts --outfile dist/ez-context"
```

### publishConfig for Scoped Public Package
```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

---

## Format Output Paths Summary

| Format | Output Path (relative to outputDir) | Write Strategy |
|--------|-------------------------------------|----------------|
| `claude` | `CLAUDE.md` | `writeWithMarkers` |
| `agents` | `AGENTS.md` | `writeWithMarkers` |
| `cursor` | `.cursor/rules/ez-context.mdc` | `writeFile` (direct, full file) |
| `copilot` | `.github/copilot-instructions.md` | `writeWithMarkers` (may have user content) |
| `skills` | `.skills/ez-context/SKILL.md` | `writeFile` (direct, full file) |
| `rulesync` | `.rulesync/rules/ez-context.md` | `writeWithMarkers` |
| `ruler` | `.ruler/ez-context.md` | `writeFile` (direct, plain markdown) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `.cursorrules` file | `.cursor/rules/*.mdc` with frontmatter | Cursor v0.43+ (2024) | Project-level rules now support per-file glob matching |
| `copilot-instructions.md` only | Multiple `.github/instructions/*.instructions.md` | July 2025 | More granular per-path instructions; our target is still the main file |
| SKILL.md as Anthropic-only | Open standard at agentskills.io, 26+ platforms | December 2025 | Cross-platform; safe to generate |

**Deprecated/outdated:**
- `.cursorrules` (flat file in project root): Still works but superseded by `.cursor/rules/`. Don't generate this format.
- Ruler `instructions.md` (legacy): Use `AGENTS.md` as the primary file name. We target `ez-context.md` as an additive file, not replacing the primary.

---

## Open Questions

1. **Rulesync `targets` field content**
   - What we know: Frontmatter `targets` field controls which tools receive the rule
   - What's unclear: Whether targets should be `"*"` or a specific list like `["claudecode", "cursor"]`
   - Recommendation: Use `targets: ["*"]` to maximize compatibility. Users can edit the generated file to restrict.

2. **Copilot instructions marker behavior**
   - What we know: GitHub Copilot reads the entire `.github/copilot-instructions.md` file
   - What's unclear: Whether HTML comment markers (`<!-- ez-context:start -->`) in the file confuse Copilot
   - Recommendation: Use `writeWithMarkers` but test that Copilot ignores the HTML comment markers. If problematic, fall back to direct `writeFile` (overwrite on each run).

3. **Multiple format flag parsing**
   - What we know: Commander supports `.option()` with custom parsing
   - What's unclear: Whether `--format cursor,copilot` (comma-separated) or `--format cursor --format copilot` (repeated flag) is the better UX
   - Recommendation: Use comma-separated string (`--format cursor,copilot`) matching GEN-08 spec which says "select output formats." Simpler to parse, shorter to type.

---

## Sources

### Primary (HIGH confidence)
- [cursor.com/docs/context/rules](https://cursor.com/docs/context/rules) — MDC file format, frontmatter fields verified
- [agentskills.io/specification](https://agentskills.io/specification) — SKILL.md format, frontmatter fields, progressive disclosure verified
- [docs.github.com copilot custom instructions](https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) — copilot-instructions.md format verified
- [bun.com/docs/bundler/executables](https://bun.com/docs/bundler/executables) — bun compile flags and cross-compilation verified
- [docs.npmjs.com creating-and-publishing-scoped-public-packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) — publishConfig.access verified

### Secondary (MEDIUM confidence)
- [github.com/dyoshikawa/rulesync](https://github.com/dyoshikawa/rulesync) — .rulesync/ directory structure (multiple sources agree on format)
- [github.com/intellectronica/ruler](https://github.com/intellectronica/ruler) — .ruler/ directory structure (multiple sources agree)

### Tertiary (LOW confidence)
- WebSearch: Rulesync `targets` field behavior with `"*"` — not directly verified against official docs, behavior inferred from README
- WebSearch: Copilot marker compatibility — no official statement that HTML comments are ignored

---

## Metadata

**Confidence breakdown:**
- Output format specs (cursor, copilot, skills): HIGH — verified from official docs
- Rulesync/Ruler directory structure: MEDIUM — verified from GitHub README, not official spec docs
- npm publishConfig: HIGH — verified from official npm docs
- bun compile: HIGH — verified from official bun docs
- Emitter architecture: HIGH — follows existing verified codebase patterns

**Research date:** 2026-02-28
**Valid until:** 2026-03-30 (formats like SKILL.md are from December 2025, monitor for breaking changes)
