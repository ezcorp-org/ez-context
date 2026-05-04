# Example: Setting Up and Maintaining Project Context

> [ez-context](https://ez-context.ezcorp.org) — extract conventions and generate AI context files with drift detection.

## Scenario

A developer joins a TypeScript project and wants AI assistants to understand the project's conventions. They need CLAUDE.md and AGENTS.md generated automatically, and want to keep them fresh as the codebase evolves.

## Walkthrough

### Step 1: Inspect detected conventions

```bash
ez-context inspect --threshold 0.5
```

Response:
```
STACK
  ● Language: TypeScript (95%)
  ● Build: tsc (100%)
  ● Package Manager: bun (100%)
  ● TypeScript strict mode enabled (100%)

IMPORTS
  ● ES modules (package.json "type": "module") (100%)

TESTING
  ● Script "test": vitest run (100%)
  ● Test files in tests/ directory (95%)

NAMING
  ● functions use camelCase naming (95%)
  ● classes use PascalCase naming (95%)

ERROR_HANDLING
  ● try/catch imperative error handling (79%)

Found 10 conventions across 5 categories (threshold: 0.5)
```

### Step 2: Generate context files

```bash
ez-context generate --format claude,agents
```

This creates:
- `CLAUDE.md` with project stack, conventions, and code style
- `AGENTS.md` with commands, testing setup, and code style

Both files use `<!-- ez-context:start/end -->` markers so you can add custom sections outside the markers.

### Step 3: Add custom context

Edit `CLAUDE.md` and add project-specific instructions outside the markers:

```markdown
# My Custom Instructions

Always use the repository's error handling pattern...

<!-- ez-context:start -->
(auto-generated content here)
<!-- ez-context:end -->

# Additional Notes

The API module is being refactored...
```

The custom sections above and below the markers will survive regeneration.

### Step 4: Check for drift later

After weeks of development, check if the context files still match the code:

```bash
ez-context drift
```

Response:
```
Drift Report — CLAUDE.md
Health Score: 78/100

Confirmed (GREEN):
  ✔ Language: TypeScript (0.95)
  ✔ functions use camelCase naming (0.92)
  ✔ ES modules (0.98)

Possibly Stale (YELLOW):
  ⚠ Build: tsc (0.52) — project now uses tsdown

Contradicted (RED):
  ✘ Test files in tests/ directory (0.28) — tests moved to co-located __tests__/
```

### Step 5: Update stale sections

```bash
ez-context update --dry-run
```

Preview the changes, then apply:

```bash
ez-context update
```

Only the auto-generated sections between markers are updated. Your custom instructions are preserved.

### Step 6: Generate for other tools

Need Cursor rules too? Add more formats:

```bash
ez-context generate --format cursor,copilot
```

This creates `.cursor/rules/ez-context.mdc` and `.github/copilot-instructions.md` from the same detected conventions.

## Key Patterns

- **Inspect before generating** to verify detected conventions look correct
- **Use `--dry-run`** before any write operation
- **Add custom context outside markers** — it survives regeneration
- **Run `drift` periodically** to catch stale claims (CI integration works well)
- **Lower `--threshold`** if too few conventions are detected
- **Generate multiple formats** from one command to keep all AI tools in sync
