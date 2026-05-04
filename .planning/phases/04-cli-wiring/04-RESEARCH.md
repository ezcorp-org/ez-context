# Phase 4: CLI Wiring - Research

**Researched:** 2026-02-28
**Domain:** Node.js CLI (Commander.js v14, ora, chalk, tsdown multi-entry)
**Confidence:** HIGH

## Summary

Phase 4 wires the existing extraction/emission pipelines into a user-facing CLI. The pipeline
(`extractConventions`) and emission (`emit`) functions are already fully built and tested. This
phase's job is entirely orchestration: create `src/cli.ts`, invoke the pipeline with good UX
(progress spinners, colored output, dry-run preview, `--yes` non-interactive mode), and wire up
the `inspect` subcommand to display detected conventions.

The standard stack is already partially present in `node_modules`. Commander.js v14.0.3 and
chalk v4.1.2 are both installed but not yet depended upon in `package.json`. The one missing
piece is a spinner library — `ora` and `yocto-spinner` are both absent; `ora` v9 (pure ESM,
bun-compatible) is the ecosystem standard.

**Primary recommendation:** Add `commander`, `chalk`, and `ora` to `dependencies` in
`package.json`. Create `src/cli.ts` as the CLI entry point with a `#!/usr/bin/env node` shebang.
Add `src/cli.ts` as a second entry in `tsdown.config.ts` and add a `bin` field to `package.json`.
Use `program.parseAsync()` (not `program.parse()`) because all action handlers are async.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| commander | 14.0.3 (installed) | CLI argument parsing, subcommands, help generation | De facto Node.js CLI standard; v14 requires Node 20 which this project already targets |
| chalk | 4.1.2 (installed) | Terminal color and styling | Installed, ESM-via-CJS wrappable; only one needed for this scope |
| ora | 9.x (not installed) | Terminal spinner for async operations | Pure ESM, bun-compatible, sindresorhus ecosystem; pairs with chalk |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:path, node:process | built-in | CWD resolution, argv, exit codes | Always — no third-party needed |
| node:fs/promises | built-in | Check if outputDir is writable | For pre-flight validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ora | yocto-spinner | Smaller bundle; same API. Either works; ora is more established and already in lockfile transitively |
| chalk | picocolors | Already installed in devDeps transitively but chalk is the explicitly listed dep |
| commander | cac | cac is present in node_modules (via tsdown); but commander has better TypeScript types and docs |

### Installation
```bash
bun add commander chalk ora
```

Note: `commander` and `chalk` are already in `node_modules` (pulled in transitively) but are NOT
listed in `package.json` `dependencies`. They must be added explicitly for the production binary
to resolve them correctly after `bun install --production`.

## Architecture Patterns

### Recommended Project Structure
```
src/
  cli.ts           # Entry point — shebang, program setup, parseAsync()
  commands/
    generate.ts    # generate subcommand action handler
    inspect.ts     # inspect subcommand action handler
  index.ts         # Library barrel (unchanged)
```

The `commands/` subdirectory keeps each subcommand's logic isolated and testable. The CLI entry
point should be thin: import the command modules, register them with commander, call parseAsync().

### Pattern 1: Commander.js Async Subcommand Structure
**What:** Subcommands registered via `.command()` with async `.action()` handlers; program uses
`.parseAsync()` to await them.
**When to use:** Any time an action handler performs I/O (file writes, process spawning, etc.)
**Example:**
```typescript
// Source: Commander.js Readme (tj/commander.js) — parseAsync section
import { Command } from "commander";
import { generateAction } from "./commands/generate.js";
import { inspectAction } from "./commands/inspect.js";

const program = new Command();

program
  .name("ez-context")
  .description("Generate AI context files from any project")
  .version("0.0.0");

program
  .command("generate")
  .description("Extract conventions and generate CLAUDE.md and AGENTS.md")
  .argument("[path]", "project root to analyze", ".")
  .option("--dry-run", "show what would be generated without writing files")
  .option("-y, --yes", "non-interactive mode, skip confirmations")
  .option("--output <dir>", "output directory", ".")
  .option("--threshold <number>", "confidence threshold 0-1", "0.7")
  .action(generateAction);

program
  .command("inspect")
  .description("Display detected conventions in the terminal")
  .argument("[path]", "project root to analyze", ".")
  .option("--threshold <number>", "confidence threshold 0-1", "0.7")
  .action(inspectAction);

await program.parseAsync();
```

### Pattern 2: Shebang + tsdown Multi-Entry
**What:** CLI entry gets `#!/usr/bin/env node` as first line; tsdown receives both entries.
**When to use:** Any CLI binary distribution

```typescript
// src/cli.ts — first line must be shebang
#!/usr/bin/env node
```

```typescript
// tsdown.config.ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  clean: true,
  dts: true,          // only needed for index.ts — cli.ts doesn't need types
  sourcemap: true,
  target: "node20",
  outDir: "dist",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
```

tsdown preserves shebang lines automatically — no plugin needed.

```json
// package.json addition
{
  "bin": {
    "ez-context": "./dist/cli.js"
  }
}
```

### Pattern 3: ora Spinner Around Async Operations
**What:** Spinner starts before slow operation, transitions to success/fail on completion.
**When to use:** Any operation that may take >200ms (ez-search indexing can take 30s+)

```typescript
// Source: sindresorhus/ora README
import ora from "ora";

const spinner = ora("Analyzing project conventions...").start();
try {
  const registry = await extractConventions(projectPath);
  spinner.succeed("Analysis complete");
  return registry;
} catch (err) {
  spinner.fail("Analysis failed");
  throw err;
}
```

### Pattern 4: Dry-Run Output
**What:** Print what would be written without writing. Use chalk for visual differentiation.
**When to use:** `--dry-run` flag

```typescript
import chalk from "chalk";
import { emit } from "../emitters/index.js";

const result = await emit(registry, { outputDir, dryRun: true });

console.log(chalk.bold("\nDry run — no files written\n"));
console.log(chalk.cyan("--- CLAUDE.md ---"));
console.log(result.claudeMd);
console.log(chalk.cyan("--- AGENTS.md ---"));
console.log(result.agentsMd);
```

### Pattern 5: inspect Command Display
**What:** Run extractConventions, then display registry in a structured terminal format.
**When to use:** `ez-context inspect` subcommand

```typescript
// Display conventions grouped by category
for (const [category, entries] of groupedConventions) {
  console.log(chalk.bold(`\n${category.toUpperCase()}`));
  for (const entry of entries) {
    const confidence = (entry.confidence * 100).toFixed(0);
    const bar = confidence >= 80 ? chalk.green("●") : chalk.yellow("●");
    console.log(`  ${bar} ${entry.pattern} ${chalk.gray(`(${confidence}%)`)}`);
  }
}
```

### Anti-Patterns to Avoid
- **Using `program.parse()` with async actions:** The program exits before promises resolve. Always use `parseAsync()`.
- **Calling `process.exit()` in action handlers:** Let commander handle exit codes via `program.error()`. Only call `process.exit(1)` in a top-level catch.
- **Importing from the library barrel in cli.ts:** Import directly from `./core/pipeline.js`, `./emitters/index.js` etc. to avoid circular issues.
- **Spinner active during `console.log()`:** Always stop spinner before logging. ora's `.succeed()` / `.fail()` handle this; don't mix `.stop()` + `console.log` manually.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom argv parser | commander | Type coercion, help generation, error display are non-trivial |
| Terminal spinner | setInterval + process.stdout.write | ora | Handles TTY detection, CI environments, SIGINT cleanup |
| Color output | ANSI escape codes directly | chalk | Handles NO_COLOR, terminal capability detection |
| Progress for ez-search indexing | Manual ETA calculation | ora + spinner.text updates | ez-search `index()` is a black box — we can only show "indexing..." not a percentage bar |

**Key insight:** The spinner and color libraries handle CI/non-TTY environments automatically.
`ora` detects non-TTY (e.g. CI) and falls back to plain text output. `chalk` respects `NO_COLOR`
and `FORCE_COLOR` env vars. Hand-rolling either would miss these edge cases.

## Common Pitfalls

### Pitfall 1: Missing `await program.parseAsync()`
**What goes wrong:** Async action handlers start but the process exits before they finish. No error, no output.
**Why it happens:** `program.parse()` is synchronous. Async action handlers are fire-and-forget.
**How to avoid:** Always use `await program.parseAsync()` in the CLI entry point. Wrap in `async` IIFE or top-level await (ESM supports top-level await).
**Warning signs:** `ez-context generate` exits immediately with no output.

### Pitfall 2: commander and chalk not in `package.json` dependencies
**What goes wrong:** `bun install --production` skips devDeps, so the CLI binary fails at runtime with module-not-found errors.
**Why it happens:** `commander` and `chalk` are already in `node_modules` as transitive deps of tsdown/vitest, but they aren't listed as direct deps.
**How to avoid:** Run `bun add commander chalk ora` before writing CLI code, which adds them to `dependencies`.

### Pitfall 3: Shebang missing or in wrong position
**What goes wrong:** Running `./dist/cli.js` directly fails with "SyntaxError: Invalid or unexpected token".
**Why it happens:** Node/Bun require the shebang to be the literal first bytes of the file.
**How to avoid:** `#!/usr/bin/env node` must be the first line of `src/cli.ts`, before any imports. tsdown preserves shebang lines.
**Warning signs:** `./dist/cli.js` fails but `node dist/cli.js` works.

### Pitfall 4: tsdown dts: true generates types for cli.ts
**What goes wrong:** tsdown tries to emit `.d.ts` for `cli.ts`, which may cause TypeScript errors (shebang comment is technically not valid TS).
**Why it happens:** `dts: true` applies globally to all entries.
**How to avoid:** Either use `dts: { entry: ['src/index.ts'] }` to restrict type generation to the library entry only, or set `dts: false` for the cli entry using tsdown's entry-specific config (check tsdown docs for `entry` object format with per-entry options). Simplest: set `dts: true` globally — tsdown handles shebangs correctly as of v0.20.

### Pitfall 5: CWD vs explicit path handling
**What goes wrong:** `ez-context generate` with no arguments silently operates on the wrong directory.
**Why it happens:** Using `process.cwd()` works at runtime but tests running from different directories get unexpected results.
**How to avoid:** Accept `[path]` as an optional argument (default `.`), resolve it to absolute with `path.resolve(userProvidedPath)`, and pass the absolute path to `extractConventions`.

### Pitfall 6: ez-search indexing is slow and silent
**What goes wrong:** `ez-context generate` hangs for 30+ seconds with no output on unindexed projects.
**Why it happens:** `EzSearchBridge.ensureIndex()` calls `index()` which is a long-running operation with no callbacks/events.
**How to avoid:** Show a spinner BEFORE calling `ensureIndex`, update spinner text to indicate "indexing..." then transition back to "analyzing..." after. The bridge's `hasIndex()` check is fast.

## Code Examples

Verified patterns from official sources:

### Commander.js Program Setup (ESM + TypeScript)
```typescript
// Source: tj/commander.js Readme — TypeScript section
import { Command } from "commander";

const program = new Command();

program
  .name("ez-context")
  .description("Generate AI context files from any project")
  .version("0.0.0");
```

### Async Action with parseAsync
```typescript
// Source: tj/commander.js Readme — parseAsync section
program
  .command("generate")
  .action(async (path, options) => {
    await doSomethingAsync(path, options);
  });

// Must use parseAsync when any action is async
await program.parseAsync();
```

### ora Spinner Lifecycle
```typescript
// Source: sindresorhus/ora README
import ora from "ora";

const spinner = ora("Checking index...").start();
const hasIndex = await bridge.hasIndex(projectPath);

if (!hasIndex) {
  spinner.text = "Indexing project (this may take a moment)...";
  await bridge.ensureIndex(projectPath);
}

spinner.text = "Analyzing conventions...";
const registry = await extractConventions(projectPath);
spinner.succeed(`Analysis complete (${registry.conventions.length} conventions found)`);
```

### emit() Call in generate Action
```typescript
// Source: src/emitters/index.ts (existing code)
const result = await emit(registry, {
  outputDir: path.resolve(options.output ?? "."),
  dryRun: options.dryRun ?? false,
  confidenceThreshold: parseFloat(options.threshold ?? "0.7"),
});
```

### Output Summary After Generate
```typescript
import chalk from "chalk";

if (result.filesWritten.length > 0) {
  console.log(chalk.green("\nGenerated:"));
  for (const file of result.filesWritten) {
    console.log(`  ${chalk.bold(file)}`);
  }
} else {
  console.log(chalk.yellow("\nDry run — no files written"));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `program.parse()` | `program.parseAsync()` | Commander v4+ | Required for any async action handler |
| `require('chalk')` CJS | `import chalk from 'chalk'` ESM | chalk v5 | Project is ESM-only; use ESM import syntax |
| Roll your own spinner | `ora` | Always | ora handles TTY detection, CI, SIGINT |

**Deprecated/outdated:**
- `chalk` v5+ is pure ESM but the installed version is 4.1.2 (CJS). This is fine — chalk 4 works in ESM via default import. Don't upgrade to chalk v5 without testing.
- `yargs` — heavy, not needed here; commander is already installed.

## Open Questions

1. **tsdown per-entry dts configuration**
   - What we know: `dts: true` in tsdown config generates types for all entries
   - What's unclear: Whether tsdown v0.20 supports per-entry dts control via entry object syntax
   - Recommendation: Use `dts: true` globally — tsdown handles shebang stripping; if type errors arise from cli.ts, add `// @ts-nocheck` at top or use entry object to restrict dts to `src/index.ts` only

2. **Chalk version compatibility (v4 CJS in ESM project)**
   - What we know: chalk 4.1.2 uses CJS, project is ESM-only
   - What's unclear: Whether `import chalk from 'chalk'` works at runtime with bun + tsdown bundled output
   - Recommendation: Test the chalk import at the start of implementation; if it fails, swap to `picocolors` (already in node_modules, pure ESM)

## Sources

### Primary (HIGH confidence)
- Commander.js Readme at `/home/dev/work/ez-context/node_modules/commander/Readme.md` — parseAsync, subcommands, TypeScript usage, async action handlers
- Existing source code: `src/core/pipeline.ts`, `src/emitters/index.ts`, `src/emitters/types.ts` — pipeline and emit API shapes
- `package.json` — installed dependencies (commander 14.0.3, chalk 4.1.2)
- tsdown docs at https://tsdown.dev — multiple entry points configuration verified

### Secondary (MEDIUM confidence)
- ora GitHub README (https://github.com/sindresorhus/ora) — spinner API, version 9.x current, pure ESM, bun-compatible
- WebSearch verified: tsdown shebang handling — community consensus that tsdown preserves shebang lines automatically

### Tertiary (LOW confidence)
- WebSearch: commander.js v14 breaking changes (Node 20 requirement) — consistent with package.json `engines.node >= 20.19.0`
- WebSearch: chalk v4 CJS in ESM context with bun — not directly verified; flag for testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — commander and chalk are in node_modules with versions confirmed; ora version from npm registry via WebSearch
- Architecture: HIGH — commander v14 API read directly from installed README; existing pipeline API read from source
- Pitfalls: HIGH — parseAsync pitfall confirmed by commander README and WebSearch; chalk CJS/ESM compat is MEDIUM (flag for testing)

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (commander and ora are stable; tsdown moves faster)
