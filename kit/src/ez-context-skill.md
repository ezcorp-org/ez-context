---
name: ez-context
description: Extract coding conventions from a project and generate AI context files (CLAUDE.md, AGENTS.md, Cursor, Copilot, etc.) with drift detection.
---

# ez-context — Convention Extraction & Context Generation

## When to Use

Use ez-context when you need to **generate or maintain AI context files** for a project:
- Setting up CLAUDE.md, AGENTS.md, or Cursor rules for a new or existing project
- Checking if context files have drifted from the actual codebase
- Onboarding to a project and need to understand its conventions
- Teams using multiple AI tools that each need their own context format

**Do NOT use for:** manually curated context files the user wants to maintain by hand, projects with fewer than a handful of source files, or non-code projects.

## Commands

### generate (primary command)

```bash
ez-context generate [path] --format <formats> --dry-run [options]
```

Options:
- `--format <formats>` — comma-separated output formats (default: `claude,agents`)
  - Available: `claude`, `agents`, `cursor`, `copilot`, `skills`, `rulesync`, `ruler`
- `--dry-run` — preview output without writing files
- `--threshold <0-1>` — confidence threshold for including conventions (default: 0.7)
- `--output <dir>` — output directory (default: `.`)
- `-y, --yes` — non-interactive mode

### inspect

```bash
ez-context inspect [path] --threshold <0-1>
```

Display detected conventions with confidence scores. Use `--threshold 0.5` to see more candidates.

### drift

```bash
ez-context drift [path] --file <contextFile>
```

Check if context files still match the actual code. Returns a health score (0-100) with GREEN/YELLOW/RED claim status.

### update

```bash
ez-context update [path] --file <contextFile> --dry-run
```

Regenerate only drifted sections. Manual content outside `<!-- ez-context:start/end -->` markers is preserved.

## Output Formats

| Format | File Path | Preserves Manual Edits |
|--------|-----------|----------------------|
| claude | `CLAUDE.md` | Yes (markers) |
| agents | `AGENTS.md` | Yes (markers) |
| cursor | `.cursor/rules/ez-context.mdc` | No (overwrites) |
| copilot | `.github/copilot-instructions.md` | Yes (markers) |
| skills | `.skills/ez-context/SKILL.md` | No (overwrites) |
| rulesync | `.rulesync/rules/ez-context.md` | Yes (markers) |
| ruler | `.ruler/ez-context.md` | No (overwrites) |

## Convention Categories

ez-context detects conventions in these categories:
- **stack** — language, build tool, package manager, TypeScript config
- **imports** — ESM vs CommonJS, import patterns
- **naming** — camelCase, PascalCase, snake_case detection
- **testing** — test runner, test file locations, scripts
- **error_handling** — try/catch, Result types, custom error classes
- **architecture** — project structure, layers, patterns

## Tips

- Run `inspect` first to see what conventions are detected before generating
- Use `--dry-run` with `generate` to preview output before writing
- Lower `--threshold` to 0.5 to see more conventions (default 0.7 is conservative)
- Run `drift` periodically to catch stale context files
- Marker-based formats (claude, agents, copilot, rulesync) let you add custom sections that survive regeneration
