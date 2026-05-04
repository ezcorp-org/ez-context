# ez-context

Extract coding conventions from any project and generate AI context files -- CLAUDE.md, AGENTS.md, Cursor rules, GitHub Copilot instructions, and more -- with built-in drift detection.

## Why

AI coding assistants work better when they understand your project's conventions. ez-context scans your codebase, detects patterns (stack, naming, architecture, error handling, imports), and generates context files that keep your tools aligned with how you actually write code.

When your code evolves, conventions drift. ez-context detects that drift and surgically updates only the stale sections, preserving any manual edits you've made.

## Features

- **7 output formats** -- CLAUDE.md, AGENTS.md, Cursor `.mdc`, GitHub Copilot, SKILL.md, Rulesync, Ruler
- **Multi-language extraction** -- TypeScript, Go, Rust (via package.json, go.mod, Cargo.toml, tsconfig, lockfiles, CI configs)
- **Semantic + static analysis** -- combines file-based signals with ts-morph code analysis for imports, naming patterns, error handling, and architecture layers
- **Drift detection** -- compares context files against live code and produces a health score (0-100)
- **Targeted updates** -- rewrites only drifted sections using marker-based splicing, leaving your manual content untouched
- **Confidence thresholds** -- filter conventions by confidence score before generating

## Install

```bash
npm install -g @ez-corp/ez-context
```

Or with other package managers:

```bash
pnpm add -g @ez-corp/ez-context
yarn global add @ez-corp/ez-context
```

## Quick Start

### Generate context files

```bash
# Default: generates CLAUDE.md and AGENTS.md
ez-context generate

# Pick specific formats
ez-context generate --format claude,cursor,copilot

# All 7 formats at once
ez-context generate --format claude,agents,cursor,copilot,skills,rulesync,ruler

# Preview without writing anything
ez-context generate --dry-run

# Custom output directory and confidence threshold
ez-context generate --output ./docs --threshold 0.8
```

### Inspect detected conventions

```bash
# Show what ez-context found in the current project
ez-context inspect

# Lower the threshold to see more candidates
ez-context inspect --threshold 0.5
```

### Check for drift

```bash
# Check all generated context files
ez-context drift

# Check a specific file
ez-context drift --file CLAUDE.md
```

### Update drifted sections

```bash
# Rewrite drifted sections, preserve manual content
ez-context update

# Preview what would change
ez-context update --dry-run

# Update a specific file
ez-context update --file CLAUDE.md
```

## Output Formats

| `--format` value | Output path | Description |
|---|---|---|
| `claude` | `CLAUDE.md` | Claude Code project instructions |
| `agents` | `AGENTS.md` | OpenAI Agents / general agent instructions |
| `cursor` | `.cursor/rules/ez-context.mdc` | Cursor IDE rules (MDC format) |
| `copilot` | `.github/copilot-instructions.md` | GitHub Copilot workspace instructions |
| `skills` | `.skills/ez-context/SKILL.md` | Claude Code skill file |
| `rulesync` | `.rulesync/rules/ez-context.md` | Rulesync-compatible rules |
| `ruler` | `.ruler/ez-context.md` | Ruler-compatible rules |

Formats that support markers (`claude`, `agents`, `copilot`, `rulesync`) preserve your manual sections across regenerations. Content outside `<!-- ez-context:start -->` / `<!-- ez-context:end -->` markers is never touched.

## How It Works

ez-context runs two extraction passes in parallel:

1. **Static extractors** -- read package.json, lockfiles, tsconfig.json, Cargo.toml, go.mod, CI configs, and project structure. Fast, deterministic, no ML required.

2. **Code/semantic extractors** -- analyze source files with ts-morph for import patterns, naming conventions (camelCase vs snake_case), architecture layers, and error-handling styles.

Each detected convention gets a confidence score between 0 and 1. Anything below `--threshold` (default `0.7`) is excluded from output. The conventions are collected into a structured registry, deduplicated, then rendered into whichever output formats you request.

## CLI Reference

```
ez-context generate [path]
  --format <formats>     Output formats, comma-separated (default: claude,agents)
  --output <dir>         Output directory (default: .)
  --threshold <number>   Confidence threshold 0-1 (default: 0.7)
  --dry-run              Preview without writing files
  -y, --yes              Non-interactive mode

ez-context inspect [path]
  --threshold <number>   Confidence threshold 0-1 (default: 0.7)

ez-context drift [path]
  --file <contextFile>   Specific context file to check

ez-context update [path]
  --file <contextFile>   Specific context file to update
  --dry-run              Preview changes without writing
  -y, --yes              Non-interactive mode
```

`[path]` defaults to the current directory in all commands.

## Programmatic API

ez-context also exports its core functions for use as a library:

```typescript
import { extractConventions } from "@ez-corp/ez-context";
import { emit, renderClaudeMd } from "@ez-corp/ez-context";

const registry = await extractConventions("./my-project");
const result = await emit(registry, {
  outputDir: ".",
  formats: ["claude", "cursor"],
  confidenceThreshold: 0.8,
  dryRun: false,
});
```

Individual renderers are also available: `renderClaudeMd`, `renderAgentsMd`, `renderCursorMdc`, `renderCopilotMd`, `renderSkillMd`, `renderRulesyncMd`, `renderRulerMd`.

## Requirements

- Node.js >= 20.19.0

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a PR.

```bash
# Clone and install
git clone https://github.com/ezcorp-org/ez-context.git
cd ez-context
npm install

# Development
npm run dev -- generate        # run CLI in dev mode
npm test                       # run tests
npm run lint                   # lint
npm run typecheck              # type-check
```

### Project structure

```
src/
  cli.ts                       # CLI entry point (Commander.js)
  commands/                    # Command handlers (generate, inspect, drift, update)
  core/
    pipeline.ts                # Extraction pipeline orchestration
    schema.ts                  # Convention registry schema (Zod)
    registry.ts                # Immutable registry operations
    drift/                     # Drift detection (claim extraction + scoring)
    updater.ts                 # Targeted section updates
  extractors/
    static/                    # File-based extractors (package.json, tsconfig, CI, etc.)
    code/                      # AST-based extractors (imports, naming)
    semantic/                  # Semantic extractors (error handling, architecture)
  emitters/                    # Output format renderers + marker-based writer
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed design documentation.

## License

ISC -- see [LICENSE](./LICENSE)
