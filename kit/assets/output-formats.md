# ez-context Output Formats

## Format Reference

| Format | File Path | Write Strategy | Best For |
|--------|-----------|---------------|----------|
| **claude** | `CLAUDE.md` | Markers | Claude Code project context |
| **agents** | `AGENTS.md` | Markers | OpenAI Agents, general AI agents |
| **cursor** | `.cursor/rules/ez-context.mdc` | Direct | Cursor IDE rules |
| **copilot** | `.github/copilot-instructions.md` | Markers | GitHub Copilot workspace instructions |
| **skills** | `.skills/ez-context/SKILL.md` | Direct | Claude Code skill definitions |
| **rulesync** | `.rulesync/rules/ez-context.md` | Markers | Rulesync-compatible rule sets |
| **ruler** | `.ruler/ez-context.md` | Direct | Ruler-compatible rule sets |

## Write Strategies

### Markers (claude, agents, copilot, rulesync)

Uses `<!-- ez-context:start -->` and `<!-- ez-context:end -->` HTML comments. Content between markers is auto-generated. Content outside markers is **preserved** across regeneration and updates.

```markdown
# My Custom Instructions          ← preserved
(your manual content here)

<!-- ez-context:start -->          ← auto-generated below
# Project Context
## Stack
...
<!-- ez-context:end -->            ← auto-generated above

# Additional Notes                ← preserved
(your manual content here)
```

### Direct (cursor, skills, ruler)

Overwrites the entire file on each generation. Do not add manual content to these files.

## Quick Reference

```bash
# Generate defaults (CLAUDE.md + AGENTS.md)
ez-context generate

# Generate specific formats
ez-context generate --format claude,cursor,copilot

# Generate all 7 formats
ez-context generate --format claude,agents,cursor,copilot,skills,rulesync,ruler

# Preview without writing
ez-context generate --format claude --dry-run
```

## Convention Categories Included

All formats include the same detected conventions, formatted for their target tool:

| Category | What It Detects |
|----------|----------------|
| **stack** | Language, build tool, package manager, TypeScript config |
| **imports** | ESM vs CommonJS, import patterns |
| **naming** | camelCase, PascalCase, snake_case conventions |
| **testing** | Test runner, file locations, test scripts |
| **error_handling** | try/catch, Result types, custom error classes |
| **architecture** | Project structure, layers, detected patterns |
