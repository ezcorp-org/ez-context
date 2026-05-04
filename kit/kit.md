---
schema: "kit/1.0"
slug: "ez-context"
title: "ez-context: AI Context File Generator with Drift Detection"
summary: "Extract coding conventions and generate CLAUDE.md, AGENTS.md, Cursor rules, and more — with semantic drift detection."
version: "0.1.17"
license: "ISC"

model:
  provider: "Anthropic"
  name: "claude-sonnet-4-6"
  hosting: "cloud API — any agent works as orchestrator. ez-context runs local analysis"

tags:
  - "context-generation"
  - "conventions"
  - "claude-md"
  - "agents-md"
  - "drift-detection"
  - "code-analysis"
  - "developer-tools"
  - "cursor"
  - "copilot"
  - "onboarding"

skills:
  - "ez-context"

tools:
  - "terminal"

selfContained: false

security:
  network: "none — zero outbound network calls. All analysis runs locally"
  fileSystem: "reads project files via globby with followSymbolicLinks: false, respects .gitignore, skips node_modules/dist/.git. Writes only to specified output paths"
  codeExecution: "none — no eval(), no child_process, no shell commands executed"
  dataExfiltration: "none — no telemetry, no analytics, no data sent to any external service"
  supplyChain: "9 runtime dependencies, all pinned. Optional @ez-corp/ez-search for semantic analysis uses a pinned model (onnx-community/Qwen3-Embedding-0.6B-ONNX) — graceful fallback if unavailable"
  inputValidation: "CLI args validated via commander. Configuration schemas validated with zod"
  pathTraversal: "all file paths resolved via path.resolve() and path.join(). No user-supplied paths passed to shell"

prerequisites:
  - name: "Node.js v20.19.0+"
    check: "node -v"
  - name: "npm"
    check: "npm -v"

inputs:
  - name: "project-directory"
    description: "The project root containing source code to analyze for conventions"
  - name: "output-formats"
    description: "Comma-separated list of target formats: claude, agents, cursor, copilot, skills, rulesync, ruler"

outputs:
  - name: "context-files"
    description: "Generated AI context files (CLAUDE.md, AGENTS.md, .cursor/rules/, etc.) with detected conventions"
  - name: "convention-list"
    description: "Detected conventions with confidence scores across stack, naming, imports, testing, architecture"
  - name: "drift-report"
    description: "Health score (0-100) with GREEN/YELLOW/RED claim status showing stale vs confirmed conventions"

failures:
  - problem: "Semantic extractor fails with vector DB lock error"
    resolution: "Graceful fallback — static and code extractors still run. Conventions are extracted without semantic analysis"
    scope: "general"
  - problem: "Too few conventions detected"
    resolution: "Lower the confidence threshold with --threshold 0.5 (default is 0.7)"
    scope: "general"
  - problem: "Drift check fails on missing context file"
    resolution: "Run ez-context generate first to create the context files before checking drift"
    scope: "general"

environment:
  runtime: "Node.js v20.19.0+"
  os:
    - "linux"
    - "macos"
    - "windows"
  adaptationNotes: "All analysis runs locally. No code leaves your machine. Semantic extractors use @ez-corp/ez-search for local ML inference."

verification:
  command: "ez-context inspect --threshold 0.5"
  expected: "List of detected conventions with confidence scores grouped by category"

fileManifest:
  - path: "ez-context-skill.md"
    role: "skill"
    description: "Skill definition for ez-context CLI commands and usage patterns"
  - path: "claude-code-workflow.md"
    role: "example"
    description: "Step-by-step walkthrough of setting up and maintaining project context"
  - path: "output-formats.md"
    role: "asset"
    description: "Reference for all 7 output formats with write strategies and paths"

parameters:
  - name: "threshold"
    value: "0.7"
    description: "Confidence threshold for including conventions (0-1). Lower to see more"
  - name: "format"
    value: "claude,agents"
    description: "Default output formats. All 7: claude, agents, cursor, copilot, skills, rulesync, ruler"
---

## Goal

Enable AI agents to install and use **[ez-context](https://ez-context.ezcorp.org)** — a tool that automatically extracts coding conventions from any project and generates context files for AI assistants. It supports 7 output formats (CLAUDE.md, AGENTS.md, Cursor .mdc, GitHub Copilot, SKILL.md, Rulesync, Ruler) and includes semantic drift detection to keep context files fresh as code evolves.

No API keys, no cloud services — all analysis runs locally using static extraction, AST parsing, and optional semantic search via local ML models.

## When to Use

**Use ez-context when:**

- You need to set up CLAUDE.md, AGENTS.md, or Cursor rules for a project
- You want to check if existing context files have drifted from the actual code
- You're onboarding to a new project and want to understand its conventions
- Your team uses multiple AI tools and needs consistent context across all of them
- You want to automate context file maintenance instead of manually updating

**Do NOT use when:**

- Context files are manually curated and the user wants full control
- The project has only a few files (not enough signal for convention detection)
- You only need a single specific convention documented (just write it by hand)

## Setup

### Install

```bash
npm install -g @ez-corp/ez-context
```

Alternative package managers:
```bash
yarn global add @ez-corp/ez-context
pnpm add -g @ez-corp/ez-context
bun add -g @ez-corp/ez-context
```

### Verify Installation

```bash
ez-context inspect --threshold 0.5
```

If the command runs and lists detected conventions, installation is successful.

### First Run Expectations

ez-context uses two levels of analysis:

| Level | Extractors | Speed | What It Needs |
|-------|-----------|-------|---------------|
| Static + Code | 10 extractors | Fast | Nothing extra |
| Semantic | 2 extractors | Slower | @ez-corp/ez-search (auto-installed as dependency) |

Semantic extractors use local ML models (~900MB, downloaded on first use via ez-search). If the models aren't available, ez-context falls back gracefully to static + code extractors only.

### Supported Languages

Convention extraction works with:
- **TypeScript / JavaScript** — full AST analysis (naming, imports, error handling)
- **Go** — detected via go.mod
- **Rust** — detected via Cargo.toml
- **Any language** — static analysis of package.json, CI configs, project structure

## Steps

### 1. Inspect Conventions

```bash
ez-context inspect --threshold 0.5
```

See what conventions ez-context detects in your project. Each convention shows a confidence score (0-1). Use this to verify the analysis looks correct before generating files.

### 2. Generate Context Files

```bash
ez-context generate --format claude,agents
```

Generate CLAUDE.md and AGENTS.md from detected conventions. Use `--dry-run` to preview without writing.

Available formats: `claude`, `agents`, `cursor`, `copilot`, `skills`, `rulesync`, `ruler`

Generate all at once:
```bash
ez-context generate --format claude,agents,cursor,copilot,skills,rulesync,ruler
```

### 3. Add Custom Context

For marker-based formats (claude, agents, copilot, rulesync), add your own content outside the `<!-- ez-context:start/end -->` markers. This content is preserved across regeneration.

### 4. Check for Drift

After the codebase evolves, check if context files still match reality:

```bash
ez-context drift
```

Returns a health score (0-100):
- **GREEN** (score >= 0.65) — convention confirmed in code
- **YELLOW** (score >= 0.40) — possibly stale, worth reviewing
- **RED** (score < 0.40) — contradicted or not found in code

Check a specific file:
```bash
ez-context drift --file CLAUDE.md
```

### 5. Update Stale Sections

```bash
ez-context update --dry-run
```

Preview changes, then apply:
```bash
ez-context update
```

Only auto-generated sections between markers are rewritten. Manual content is preserved.

### 6. Keep Context in Sync

Run `ez-context drift` periodically or in CI to catch stale context files. When drift is detected, run `ez-context update` to refresh only the changed sections.

## CLI Reference

### generate

```bash
ez-context generate [path] [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--format <formats>` | `claude,agents` | Comma-separated output formats: claude, agents, cursor, copilot, skills, rulesync, ruler |
| `--dry-run` | — | Preview output without writing files |
| `--threshold <0-1>` | `0.7` | Confidence threshold for including conventions |
| `--output <dir>` | `.` | Output directory for generated files |
| `-y, --yes` | — | Non-interactive mode (skip confirmation prompts) |

### inspect

```bash
ez-context inspect [path] [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--threshold <0-1>` | `0.7` | Confidence threshold for displaying conventions |

### drift

```bash
ez-context drift [path] [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--file <contextFile>` | — | Check a specific context file instead of all |

### update

```bash
ez-context update [path] [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--file <contextFile>` | — | Update a specific context file instead of all |
| `--dry-run` | — | Preview changes without writing files |
| `-y, --yes` | — | Non-interactive mode (skip confirmation prompts) |

## Extraction Pipeline

ez-context uses a 3-tier extraction pipeline. All extractors run in parallel via `Promise.allSettled` — a failing extractor never blocks the others.

### Static Extractors (7)

| Extractor | Detects |
|-----------|---------|
| `package-json` | Language, package manager, scripts, dependencies |
| `lockfile` | Package manager confirmation from lock file type |
| `tsconfig` | TypeScript strict mode, compiler options |
| `go-mod` | Go language and module path |
| `cargo-toml` | Rust language and crate metadata |
| `ci` | CI/CD platform and pipeline commands |
| `project-structure` | Directory layout, file organization patterns |

### Code Extractors (3) — AST Analysis

| Extractor | Detects |
|-----------|---------|
| `naming` | camelCase, PascalCase, snake_case conventions |
| `imports` | ESM vs CommonJS, import patterns |
| `error-handling` | try/catch, Result types, custom error classes |

Code extractors use `ts-morph` for TypeScript/JavaScript AST analysis. Capped at 200 files per extractor to bound analysis time.

### Semantic Extractors (2) — ML-Powered

| Extractor | Detects |
|-----------|---------|
| `error-handling` | Deeper error patterns via semantic search |
| `architecture` | Architectural layers, patterns, boundaries |

Semantic extractors require `@ez-corp/ez-search` with local ML models. Falls back gracefully if unavailable.

## Programmatic API

ez-context exports a public API for integration into other tools:

```typescript
import {
  extractConventions,     // Run full extraction pipeline
  emit,                   // Generate output for a format
  runExtractors,          // Run a custom set of extractors
  createBridge,           // Create ez-search bridge for semantic analysis
  listProjectFiles,       // List project files respecting .gitignore
  writeWithMarkers,       // Write content with ez-context markers
  MARKER_START,           // "<!-- ez-context:start -->"
  MARKER_END,             // "<!-- ez-context:end -->"
  ALWAYS_SKIP,            // Default ignore patterns
} from "@ez-corp/ez-context";

// Key types
import type {
  ConventionRegistry,     // Registry of detected conventions
  Extractor,              // Extractor interface
  ExtractionContext,      // Context passed to extractors
  EmitOptions,            // Options for emit()
  EmitResult,             // Result from emit()
  EzSearchBridge,         // Semantic search bridge
  ListFilesOptions,       // Options for listProjectFiles()
} from "@ez-corp/ez-context";
```

## Constraints

- **Node.js v20.19.0+** required.
- Semantic extractors require @ez-corp/ez-search (installed as dependency). Falls back gracefully if unavailable.
- Convention detection works best on projects with 10+ source files.
- Full AST analysis: TypeScript, JavaScript only. Other languages get static analysis.
- AST extractors cap at **200 files** per extractor to bound analysis time.
- Semantic ML models require **~900MB disk** on first download (via Hugging Face, then offline).
- Marker-based formats use `<!-- ez-context:start/end -->` HTML comments. Do not edit content between markers — it will be overwritten.
- Direct-write formats (cursor, skills, ruler) overwrite the entire file on regeneration.

## Safety Notes

### No Network Access
ez-context makes zero outbound network calls. All convention extraction, file generation, and drift detection runs entirely on your machine. No source code, conventions, or generated context files are ever sent to any external service.

### No Code Execution
ez-context never calls `eval()`, spawns shell processes, or uses `child_process`. It reads source files for static and AST analysis only — it does not execute your project's code.

### File System Isolation
- Reads project files via `globby` with `followSymbolicLinks: false` to prevent symlink attacks
- Respects `.gitignore` — files your project ignores are never read
- Always skips `node_modules/`, `dist/`, `.git/`, and other generated directories
- Writes only to the specified output paths (context files like CLAUDE.md, AGENTS.md, etc.)

### Path Traversal Protection
All file paths are resolved via `path.resolve()` and `path.join()`. No user-supplied input is passed to a shell. CLI arguments are validated by `commander` and configuration schemas are validated with `zod`.

### Information Disclosure Advisory
Generated context files may reveal project structure (directory layout, naming patterns, framework choices, test setup). Review generated files before committing to public repositories.

### Marker Safety
If `<!-- ez-context:start/end -->` markers are manually edited, reordered, or corrupted, the `update` command aborts rather than risk overwriting manual content.

### Semantic Model Downloads
Semantic extractors download a pinned ML model from Hugging Face on first use via `@ez-corp/ez-search`:

- **Model**: `onnx-community/Qwen3-Embedding-0.6B-ONNX`
- **Quantized model hash (SHA-256)**: `87cd124e0ef1fd1f223ebc283efccbaeac386d0b08344701c46975d0657b591f`
- **Registry**: Model ID is hardcoded in ez-search's model registry — it cannot be changed by user input or environment variables
- **Cache**: Models are stored in `~/.ez-search/models/` and all subsequent analysis is fully offline
- **Fallback**: If models are unavailable, ez-context falls back gracefully to static + code extractors

### Runtime Dependencies

| Dependency | Purpose |
|-----------|---------|
| `commander` | CLI argument parsing |
| `chalk` | Colored terminal output |
| `ora` | Progress spinners |
| `zod` | Schema validation |
| `ts-morph` | TypeScript/JavaScript AST analysis |
| `globby` | File globbing with .gitignore support |
| `js-yaml` | YAML config parsing |
| `smol-toml` | TOML config parsing (Cargo.toml) |
| `@ez-corp/ez-search` | Local semantic search for drift detection |

## Inputs

**Project directory:** The root of the project to analyze. Works best when run from the project root. Analyzes package.json, tsconfig.json, lockfiles, CI configs, and source files to detect conventions.

**Output formats:** Comma-separated list of target formats. Default is `claude,agents`. Each format generates a file at a specific path optimized for that AI tool.

## Outputs

**Context files:** AI-readable context files containing detected conventions — stack info, naming patterns, import style, testing setup, error handling, architecture. Each format is tailored to its target tool.

**Convention list:** From `inspect` — categorized list with confidence scores (0-1) showing what was detected and how certain the tool is.

**Drift report:** From `drift` — health score (0-100) with per-claim RED/YELLOW/GREEN status. Shows which conventions in your context files still match the code and which have gone stale.

## Failures Overcome

**Semantic extractor lock errors:** The semantic extractors (error-handling, architecture) use a local vector database that can occasionally hit lock contention. ez-context handles this gracefully — the other 9 extractors still run and produce conventions. No action needed.

**Few conventions detected:** If `inspect` shows fewer conventions than expected, lower the threshold with `--threshold 0.5`. The default (0.7) is conservative and may filter out lower-confidence but still useful patterns.

**Stale context without drift data:** If drift detection reports no data, the context files may not exist yet. Run `ez-context generate` first to create them, then `drift` will have something to check.

## Learn More

Visit [ez-context.ezcorp.org](https://ez-context.ezcorp.org) for documentation, updates, and other ez-corp tools.

## Validation

After installation, verify the setup with these steps:

1. **Command available:** `ez-context inspect --threshold 0.5` lists detected conventions
2. **Generation works:** `ez-context generate --format claude --dry-run` previews a CLAUDE.md without writing
3. **Multiple formats:** `ez-context generate --format claude,agents --dry-run` shows both outputs
4. **Drift works:** After generating, `ez-context drift` returns a health score
