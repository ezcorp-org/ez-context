# Phase 2: Static Extraction - Research

**Researched:** 2026-02-28
**Domain:** Static code analysis, multi-language project detection, AST-based convention extraction
**Confidence:** HIGH

---

## Summary

Phase 2 adds the extraction layer: static extractors that read project configuration files, parse source code with ts-morph, and populate the Convention Registry defined in Phase 1. The extractors must work on any project type (JS/TS, Go, Rust, Python, etc.) without requiring ez-search embeddings.

The standard approach splits into three extractor groups: (1) stack detection extractors (package.json, go.mod, Cargo.toml, tsconfig, lockfiles, CI configs), (2) code pattern extractors (naming conventions via ts-morph AST, import organization, barrel files), and (3) a parallel extractor runner that merges all results into the Convention Registry. Non-TS/JS files are parsed with native Node.js JSON, YAML (js-yaml), and TOML (smol-toml). TS/JS files are analyzed with ts-morph v27.

The extractor architecture from ARCHITECTURE.md is the template: each extractor is a pure async function `(ctx: ExtractionContext) => Promise<ConventionEntry[]>`. They run in parallel via `Promise.allSettled()` (not `Promise.all()` — a failed extractor must not abort others). The runner assembles results into a populated registry.

**Primary recommendation:** Use ts-morph v27 for AST-based TS/JS analysis (naming, imports), js-yaml for CI config parsing, smol-toml for Cargo.toml parsing, and native JSON.parse for package.json/tsconfig. No dedicated framework detection library needed — file presence + content heuristics is sufficient and avoids a stale dependency.

---

## Standard Stack

### Core (Phase 2 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ts-morph | ^27.0.2 | AST analysis for TS/JS naming conventions and import patterns | 2.8M weekly downloads. Wraps TypeScript Compiler API with ergonomic API. `getClasses()`, `getFunctions()`, `getVariableDeclarations()`, `getImportDeclarations()` etc. Pure JS, no native deps. Already in STACK.md decision. |
| js-yaml | ^4.1.1 | Parse GitHub Actions, GitLab CI, and other YAML CI configs | 180M weekly downloads. Industry standard. Safe `yaml.load()` (no arbitrary code execution). ESM-compatible. |
| smol-toml | ^1.6.0 | Parse Cargo.toml for Rust project detection | Most downloaded TOML parser on npm (2025). 2.12x faster than @iarna/toml. TOML 1.1.0 compliant. Actively maintained. |

### Already Present (from Phase 1)

| Library | Purpose |
|---------|---------|
| zod | Registry validation after population |
| globby | File discovery for extractor inputs |
| Node.js built-ins (fs/path) | File reading, path manipulation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| js-yaml | yaml (npm) | yaml has comment preservation and YAML 1.2 strict compliance but 180M vs yaml's downloads — js-yaml is the dominant standard. Either works for CI config reading. |
| smol-toml | @iarna/toml | @iarna/toml is 6 years unmaintained, only TOML 1.0.0-rc.1. smol-toml is faster and current. |
| smol-toml | js-toml | js-toml is TOML 1.0.0 compliant, trusted by Microsoft/AWS, but smol-toml is more actively downloaded. Either is acceptable. |
| ts-morph | tree-sitter | tree-sitter requires native bindings (WASM/N-API), complicates distribution. ts-morph is pure JS and already chosen in STACK.md. |
| custom framework detection | detect-package-manager | detect-package-manager (v3.0.2) only detects package manager, not languages/frameworks. File presence heuristics give more control. |

**Installation (Phase 2 additions):**

```bash
bun add ts-morph@^27 js-yaml@^4 smol-toml@^1
bun add -d @types/js-yaml
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 scope)

```
src/
├── extractors/
│   ├── types.ts                # Extractor interface, ExtractionContext
│   ├── index.ts                # Parallel extractor runner
│   ├── static/
│   │   ├── package-json.ts     # JS/TS stack, deps, scripts (EXTR-01, EXTR-02, EXTR-03)
│   │   ├── lockfile.ts         # Package manager detection (EXTR-02)
│   │   ├── tsconfig.ts         # TypeScript presence + strict mode (EXTR-01)
│   │   ├── go-mod.ts           # Go module detection (EXTR-01)
│   │   ├── cargo-toml.ts       # Rust project detection (EXTR-01)
│   │   ├── ci.ts               # Build/test/lint commands from CI configs (EXTR-03)
│   │   └── project-structure.ts # Architecture layers, entry points (EXTR-08)
│   └── code/
│       ├── naming.ts           # camelCase/PascalCase frequency via ts-morph (EXTR-04)
│       └── imports.ts          # Import organization, barrel files (EXTR-05)
└── core/
    └── pipeline.ts             # Orchestrates extractors → registry
```

### Pattern 1: Extractor Interface (Pure Async Function)

**What:** Every extractor is stateless. It takes an `ExtractionContext` and returns `ConventionEntry[]`. No side effects. No shared state.

**When to use:** ALL extractors — stack, code pattern, CI config.

**Example:**
```typescript
// src/extractors/types.ts
import type { ConventionEntry } from "../core/schema.js";

export interface ExtractionContext {
  projectPath: string;
  options?: ExtractorOptions;
}

export interface ExtractorOptions {
  maxFilesForAst?: number;  // cap for ts-morph (default 200)
}

export interface Extractor {
  name: string;
  extract(ctx: ExtractionContext): Promise<ConventionEntry[]>;
}
```

### Pattern 2: Parallel Extractor Runner with `Promise.allSettled`

**What:** Run all extractors in parallel. Use `Promise.allSettled()` so a failing extractor does not abort others. Log failures but continue.

**When to use:** `extractors/index.ts` — the only place that orchestrates multiple extractors.

**Example:**
```typescript
// src/extractors/index.ts
import { addConvention } from "../core/registry.js";
import type { ConventionRegistry } from "../core/schema.js";
import type { Extractor, ExtractionContext } from "./types.js";

export async function runExtractors(
  extractors: Extractor[],
  ctx: ExtractionContext,
  registry: ConventionRegistry
): Promise<ConventionRegistry> {
  const results = await Promise.allSettled(
    extractors.map((e) => e.extract(ctx))
  );

  let current = registry;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      // Log but don't throw — partial extraction is better than none
      console.warn(`Extractor "${extractors[i]!.name}" failed:`, result.reason);
      continue;
    }
    for (const entry of result.value) {
      current = addConvention(current, entry);
    }
  }

  return current;
}
```

### Pattern 3: File-Existence Guard

**What:** Every extractor starts by checking if its target file exists. Return `[]` immediately if the file is absent. No errors thrown for missing files.

**When to use:** Every static extractor — package.json, go.mod, Cargo.toml, etc.

**Example:**
```typescript
// src/extractors/static/package-json.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { access } from "node:fs/promises";
import type { Extractor } from "../types.js";

export const packageJsonExtractor: Extractor = {
  name: "package-json",
  async extract(ctx) {
    const pkgPath = join(ctx.projectPath, "package.json");
    try {
      await access(pkgPath);
    } catch {
      return []; // Not a JS/TS project
    }
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    // ... analysis
    return entries;
  },
};
```

### Pattern 4: ts-morph Project Setup Without tsconfig

**What:** For naming and import analysis, create a ts-morph `Project` without requiring tsconfig. Add only the TS/JS files found via globby. Use `skipAddingFilesFromTsConfig: true` when a tsconfig exists to avoid loading all transitive deps.

**When to use:** `extractors/code/naming.ts` and `extractors/code/imports.ts`.

**Example:**
```typescript
// Source: https://ts-morph.com/setup/adding-source-files
import { Project } from "ts-morph";
import { listProjectFiles } from "../../utils/fs.js";

const files = await listProjectFiles({
  cwd: ctx.projectPath,
  extensions: ["ts", "tsx", "js", "jsx"],
});

// Cap for memory safety — analyze sample if > maxFiles
const MAX_FILES = ctx.options?.maxFilesForAst ?? 200;
const filesToAnalyze = files.slice(0, MAX_FILES);

const project = new Project({
  // No tsConfigFilePath — we manage file loading manually
  // This avoids loading all transitive deps
  compilerOptions: {
    allowJs: true,
    noEmit: true,
  },
});

project.addSourceFilesAtPaths(
  filesToAnalyze.map((f) => `${ctx.projectPath}/${f}`)
);
```

### Pattern 5: Naming Convention Detection via ts-morph

**What:** Count identifier cases across classes, functions, variables to determine predominant naming convention. Map each name to a case type, tally, pick the majority.

**When to use:** `extractors/code/naming.ts` — satisfies EXTR-04.

**Example:**
```typescript
// Source: arxiv 2502.17749 - coding style feature extraction approach
type NamingCase = "camelCase" | "PascalCase" | "snake_case" | "UPPER_SNAKE_CASE" | "other";

function detectCase(name: string): NamingCase {
  if (/^[A-Z][A-Z0-9_]+$/.test(name)) return "UPPER_SNAKE_CASE";
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return "camelCase";
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return "PascalCase";
  if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes("_")) return "snake_case";
  return "other";
}

// For each sourceFile:
for (const sourceFile of project.getSourceFiles()) {
  const funcNames = sourceFile.getFunctions()
    .map((f) => f.getName())
    .filter((n): n is string => n !== undefined);

  const varNames = sourceFile.getVariableDeclarations()
    .map((v) => v.getName());

  const classNames = sourceFile.getClasses()
    .map((c) => c.getName())
    .filter((n): n is string => n !== undefined);
  // tally cases per category...
}
```

### Pattern 6: Import Organization Detection via ts-morph

**What:** For each source file, categorize imports as relative (`./`) or absolute (node_modules/aliases). Detect barrel file usage when the resolved source file only re-exports.

**When to use:** `extractors/code/imports.ts` — satisfies EXTR-05.

**Example:**
```typescript
// Source: https://ts-morph.com/details/imports
for (const sourceFile of project.getSourceFiles()) {
  const imports = sourceFile.getImportDeclarations();

  for (const imp of imports) {
    const specifier = imp.getModuleSpecifierValue();
    const isRelative = imp.isModuleSpecifierRelative();

    if (!isRelative) {
      // External/aliased import
      externalImports.push(specifier);
    } else {
      // Check if resolved file is a barrel
      const resolved = imp.getModuleSpecifierSourceFile();
      if (resolved) {
        const isBarrel =
          resolved.getImportDeclarations().length === 0 &&
          resolved.getExportDeclarations().length > 0;
        if (isBarrel) barrelCount++;
      }
    }
  }
}
```

### Pattern 7: YAML CI Config Parsing (GitHub Actions, GitLab CI)

**What:** Use js-yaml to parse YAML CI config files. Extract `run:` commands from steps, which are the build/test/lint commands.

**When to use:** `extractors/static/ci.ts` — satisfies EXTR-03.

**Example:**
```typescript
// Source: https://github.com/nodeca/js-yaml
import { load as yamlLoad } from "js-yaml";
import { readFile } from "node:fs/promises";

const ciFiles = await globby([
  ".github/workflows/*.yml",
  ".github/workflows/*.yaml",
  ".gitlab-ci.yml",
], { cwd: ctx.projectPath, absolute: true });

for (const ciFile of ciFiles) {
  const raw = await readFile(ciFile, "utf-8");
  const workflow = yamlLoad(raw) as Record<string, unknown>;
  const jobs = (workflow?.jobs ?? {}) as Record<string, unknown>;

  for (const [, job] of Object.entries(jobs)) {
    const steps = ((job as Record<string, unknown>)?.steps ?? []) as Array<
      Record<string, unknown>
    >;
    for (const step of steps) {
      if (typeof step.run === "string") {
        // step.run contains the shell command(s)
        commands.push(step.run);
      }
    }
  }
}
```

### Pattern 8: TOML Parsing for Cargo.toml

**What:** Use smol-toml to parse Cargo.toml. The `[package]` table contains `name`, `version`. Dependencies in `[dependencies]`.

**When to use:** `extractors/static/cargo-toml.ts` — part of EXTR-01.

**Example:**
```typescript
// Source: https://github.com/squirrelchat/smol-toml
import { parse as parseToml } from "smol-toml";
import { readFile } from "node:fs/promises";

const raw = await readFile(join(ctx.projectPath, "Cargo.toml"), "utf-8");
const cargo = parseToml(raw) as Record<string, unknown>;
const pkg = cargo.package as Record<string, unknown> | undefined;
const name = pkg?.name as string | undefined;
const deps = Object.keys(
  (cargo.dependencies ?? {}) as Record<string, unknown>
);
```

### Pattern 9: Package Manager Detection via Lockfile Presence

**What:** Check for lockfiles in order of specificity: `bun.lock` → `pnpm-lock.yaml` → `yarn.lock` → `package-lock.json`. Report the first found.

**When to use:** `extractors/static/lockfile.ts` — part of EXTR-02.

**Example:**
```typescript
const LOCKFILES: Array<[string, string]> = [
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],          // older bun binary lockfile
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["package-lock.json", "npm"],
];

for (const [filename, manager] of LOCKFILES) {
  try {
    await access(join(ctx.projectPath, filename));
    return manager; // first found wins
  } catch {
    // not present, try next
  }
}
```

### Pattern 10: go.mod Parsing via Regex

**What:** `go.mod` uses a simple DSL. Parse with line-by-line regex — no library needed.

**When to use:** `extractors/static/go-mod.ts` — part of EXTR-01.

**Example:**
```typescript
const lines = raw.split("\n");
const moduleLine = lines.find((l) => l.startsWith("module "));
const goLine = lines.find((l) => l.startsWith("go "));
const moduleName = moduleLine?.replace("module ", "").trim();
const goVersion = goLine?.replace("go ", "").trim();
```

### Anti-Patterns to Avoid

- **Using `Promise.all` for extractors:** If one extractor throws, all results are lost. Use `Promise.allSettled`.
- **Loading all TS files into ts-morph with no cap:** Large monorepos can OOM. Always cap files processed (200 default; configurable).
- **Calling `project.resolveSourceFileDependencies()` after `addSourceFilesAtPaths`:** In ts-morph v27, this triggers unexpected behavior. Use only when explicitly needed for dependency resolution.
- **Parsing go.mod with a TOML library:** go.mod is NOT TOML — it is its own custom format. Regex is correct.
- **Mutating the registry object:** `addConvention` returns a new registry. Treat registry as immutable.
- **Throwing from an extractor for missing files:** Return `[]`. Missing config file just means that language/tool is not in use.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML CI config parsing | Custom YAML parser | js-yaml `yaml.load()` | YAML spec has edge cases (multi-document, anchors, special types). js-yaml is 180M downloads/week. |
| TOML parsing (Cargo.toml) | Custom TOML parser | smol-toml | TOML 1.1.0 spec is complex. smol-toml is the most downloaded, correct, and maintained option. |
| File discovery for extractors | Custom glob walker | globby (already in Phase 1) | Already available; .gitignore-aware; handles node_modules exclusion. |
| TS/JS AST traversal | Custom AST walker | ts-morph | TypeScript Compiler API is notoriously low-level. ts-morph provides `getFunctions()`, `getClasses()`, `getImportDeclarations()` etc. |
| Package manager detection | Custom lockfile scanner | Manual file-presence check | Existing `detect-package-manager` packages only detect PM, not the broader stack. Simple file existence is 5 lines and covers all 4 PMs (npm/yarn/pnpm/bun). |

**Key insight:** The goal is to detect conventions, not to build parsers. Use mature parsing libraries and focus the implementation on the analysis logic (what constitutes a convention, how to score confidence).

---

## Common Pitfalls

### Pitfall 1: ts-morph OOM on Large Codebases

**What goes wrong:** Adding thousands of source files to a ts-morph `Project` loads all AST nodes into memory simultaneously. A 5000-file TypeScript monorepo can exhaust Node.js's default 1.7GB heap.

**Why it happens:** ts-morph loads and retains all AST nodes eagerly. The TypeScript Compiler API (which ts-morph wraps) was designed for editor tooling where the entire project is in memory.

**How to avoid:** Cap the number of files analyzed for AST patterns. Use globby to list all files, then `slice(0, MAX_FILES)` before passing to ts-morph. Default `MAX_FILES = 200` is a safe default for most projects. For naming conventions, a statistical sample of 200 files is representative anyway.

Use `project.forgetNodesCreatedInBlock()` for memory cleanup if processing files in batches:
```typescript
// Source: https://ts-morph.com/manipulation/performance
await project.forgetNodesCreatedInBlock(async () => {
  // process a batch of files — nodes are GC'd after this block
});
```

**Warning signs:** `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` when running extractors on real projects.

### Pitfall 2: ts-morph Without tsconfig Misses Type Information

**What goes wrong:** Creating a `Project` without a `tsConfigFilePath` means the TypeScript compiler has no type information. Methods that rely on type checking (like resolving `getModuleSpecifierSourceFile()`) may return `undefined` more often.

**Why it happens:** Without a tsconfig, the compiler operates in "loose" mode. Module resolution cannot follow path aliases (`@/components`), so barrel file detection via `getModuleSpecifierSourceFile()` only works for relative imports.

**How to avoid:** For naming convention counting, type information is not needed — `getFunctions()`, `getClasses()`, `getVariableDeclarations()` work on raw AST without types. For import resolution, only resolve relative imports. Mark alias imports as "uses path aliases" without resolving them.

**Warning signs:** `getModuleSpecifierSourceFile()` returns `undefined` for all imports in a project that uses TypeScript path aliases.

### Pitfall 3: go.mod Is Not TOML

**What goes wrong:** Attempting to parse `go.mod` with a TOML parser. The file has `module` and `go` directives that look similar to TOML but are not.

**Why it happens:** go.mod uses a Go-specific DSL designed for the `go` toolchain. It has require blocks, replace directives, and retract statements that are not TOML.

**How to avoid:** Parse `go.mod` line by line with regex. Only three fields matter for Phase 2: `module <path>` (module name), `go <version>` (go version), and `require ( ... )` blocks (dependencies). Simple regex handles all of these.

**Warning signs:** smol-toml or js-yaml throwing parse errors on `go.mod` files.

### Pitfall 4: CI Config Extraction Yields Too Many Commands

**What goes wrong:** Extracting all `run:` steps from a GitHub Actions workflow file produces noise — install commands, debug commands, etc. — alongside the actual build/test/lint commands.

**Why it happens:** Every CI step's `run:` field gets extracted, including `echo "done"`, `mkdir -p`, `curl`, etc.

**How to avoid:** Filter extracted commands by known prefixes:
- Build: `npm run build`, `bun run build`, `cargo build`, `go build`, `make build`
- Test: `npm test`, `bun test`, `cargo test`, `go test`, `pytest`, `vitest run`, `jest`
- Lint: `eslint`, `biome`, `golangci-lint`, `clippy`, `ruff`

Use substring matching, not exact matching. Store ALL found `run:` commands in metadata so they are available for inspection.

### Pitfall 5: Stale Framework Detection Logic

**What goes wrong:** Hardcoded framework detection maps (e.g., `if (deps.includes("react"))`) become outdated as new frameworks emerge. Also, internal packages, scoped packages (`@company/ui`), or monorepo packages appear as "unknown dependencies."

**Why it happens:** Framework detection is a maintenance burden if it tries to be exhaustive.

**How to avoid:** Detect the top-N production dependencies from lockfile/package.json and store all of them as evidence. Classify well-known frameworks (React, Vue, Angular, Hono, Express, Next.js, etc.) at a high level. Anything unrecognized goes into `metadata.rawDependencies`. The AI consuming the registry can interpret unknown deps.

**Warning signs:** "Detected framework: unknown" appearing frequently on real projects.

### Pitfall 6: Naming Convention False Positives

**What goes wrong:** Single-letter variables (`i`, `x`, `e`), short names (`id`, `to`, `db`), and module-level constants cannot be classified into camelCase/PascalCase/snake_case reliably.

**Why it happens:** Short identifiers (≤3 chars) match multiple case patterns. Single-letter variables are neither camelCase nor snake_case.

**How to avoid:** Filter out identifiers shorter than 4 characters before case classification. This is the standard approach in academic tools for coding style analysis. Also filter standard loop variables and well-known single-char patterns: `_`, `e`, `i`, `k`, `n`, `t`, `v`, `x`, `y`.

---

## Code Examples

### Complete package.json Extractor (Stack + Deps + Scripts)

```typescript
// src/extractors/static/package-json.ts
// Source: ARCHITECTURE.md extractor pattern
import { readFile } from "node:fs/promises";
import { access } from "node:fs/promises";
import { join } from "node:path";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor } from "../types.js";

// Known frameworks and their canonical names
const FRAMEWORK_MAP: Record<string, string> = {
  react: "React",
  vue: "Vue",
  angular: "@angular/core",
  "next": "Next.js",
  nuxt: "Nuxt",
  svelte: "Svelte",
  hono: "Hono",
  express: "Express",
  fastify: "Fastify",
  koa: "Koa",
};

const TEST_RUNNER_MAP: Record<string, string> = {
  vitest: "Vitest",
  jest: "Jest",
  mocha: "Mocha",
  jasmine: "Jasmine",
  ava: "AVA",
};

export const packageJsonExtractor: Extractor = {
  name: "package-json",
  async extract(ctx) {
    const pkgPath = join(ctx.projectPath, "package.json");
    try {
      await access(pkgPath);
    } catch {
      return [];
    }

    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const entries: ConventionEntry[] = [];
    const evidence = [{ file: "package.json", line: null }];

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies as Record<string, string> | undefined ?? {}),
      ...(pkg.devDependencies as Record<string, string> | undefined ?? {}),
    };

    // Language: if tsconfig or TypeScript dep exists → TypeScript
    if (allDeps["typescript"] || allDeps["@types/node"]) {
      entries.push({
        category: "stack",
        pattern: "TypeScript project",
        confidence: 0.95,
        evidence,
        metadata: { language: "TypeScript" },
      });
    } else {
      entries.push({
        category: "stack",
        pattern: "JavaScript project",
        confidence: 0.8,
        evidence,
        metadata: { language: "JavaScript" },
      });
    }

    // Framework detection
    for (const [dep, frameworkName] of Object.entries(FRAMEWORK_MAP)) {
      if (allDeps[dep]) {
        entries.push({
          category: "stack",
          pattern: `Uses ${frameworkName}`,
          confidence: 1.0,
          evidence,
          metadata: { framework: frameworkName, version: allDeps[dep] },
        });
        break; // One primary framework per project
      }
    }

    // Test runner detection
    for (const [dep, runnerName] of Object.entries(TEST_RUNNER_MAP)) {
      if (allDeps[dep]) {
        entries.push({
          category: "testing",
          pattern: `Uses ${runnerName} for testing`,
          confidence: 0.95,
          evidence,
          metadata: { testRunner: runnerName },
        });
        break;
      }
    }

    // Build/test/lint commands from scripts
    const scripts = (pkg.scripts as Record<string, string> | undefined) ?? {};
    for (const [scriptName, command] of Object.entries(scripts)) {
      const category = scriptName === "test" || scriptName.startsWith("test:")
        ? "testing"
        : scriptName === "build" || scriptName === "lint"
        ? "stack"
        : null;
      if (category) {
        entries.push({
          category,
          pattern: `Script "${scriptName}": ${command}`,
          confidence: 1.0,
          evidence,
          metadata: { scriptName, command },
        });
      }
    }

    return entries;
  },
};
```

### Naming Convention Extractor (ts-morph)

```typescript
// src/extractors/code/naming.ts
// Source: https://ts-morph.com/details/source-files
//         arxiv 2502.17749 - naming convention frequency approach
import { Project } from "ts-morph";
import { listProjectFiles } from "../../utils/fs.js";
import type { Extractor } from "../types.js";
import type { ConventionEntry } from "../../core/schema.js";

type NamingCase = "camelCase" | "PascalCase" | "snake_case" | "UPPER_SNAKE_CASE" | "other";

function classifyCase(name: string): NamingCase | null {
  if (name.length < 4) return null; // skip short identifiers
  if (/^[A-Z][A-Z0-9_]{3,}$/.test(name)) return "UPPER_SNAKE_CASE";
  if (/^[A-Z][a-zA-Z0-9]+$/.test(name)) return "PascalCase";
  if (/^[a-z][a-z0-9_]+$/.test(name) && name.includes("_")) return "snake_case";
  if (/^[a-z][a-zA-Z0-9]+$/.test(name)) return "camelCase";
  return "other";
}

export const namingExtractor: Extractor = {
  name: "naming-conventions",
  async extract(ctx) {
    const files = await listProjectFiles({
      cwd: ctx.projectPath,
      extensions: ["ts", "tsx", "js", "jsx"],
    });

    if (files.length === 0) return [];

    const MAX = ctx.options?.maxFilesForAst ?? 200;
    const sample = files.slice(0, MAX);

    const project = new Project({
      compilerOptions: { allowJs: true, noEmit: true },
    });
    project.addSourceFilesAtPaths(
      sample.map((f) => `${ctx.projectPath}/${f}`)
    );

    const counts: Record<string, Record<NamingCase, number>> = {
      functions: { camelCase: 0, PascalCase: 0, snake_case: 0, UPPER_SNAKE_CASE: 0, other: 0 },
      variables: { camelCase: 0, PascalCase: 0, snake_case: 0, UPPER_SNAKE_CASE: 0, other: 0 },
      classes: { camelCase: 0, PascalCase: 0, snake_case: 0, UPPER_SNAKE_CASE: 0, other: 0 },
    };

    for (const sourceFile of project.getSourceFiles()) {
      for (const fn of sourceFile.getFunctions()) {
        const name = fn.getName();
        if (name) {
          const c = classifyCase(name);
          if (c) counts.functions[c]++;
        }
      }
      for (const v of sourceFile.getVariableDeclarations()) {
        const c = classifyCase(v.getName());
        if (c) counts.variables[c]++;
      }
      for (const cls of sourceFile.getClasses()) {
        const name = cls.getName();
        if (name) {
          const c = classifyCase(name);
          if (c) counts.classes[c]++;
        }
      }
    }

    const entries: ConventionEntry[] = [];
    const evidence = [{ file: "src/**/*.ts", line: null }];

    for (const [entityType, caseCounts] of Object.entries(counts)) {
      const total = Object.values(caseCounts).reduce((a, b) => a + b, 0);
      if (total < 5) continue; // not enough data

      const dominant = (Object.entries(caseCounts) as Array<[NamingCase, number]>)
        .sort(([, a], [, b]) => b - a)[0];

      if (!dominant) continue;
      const [dominantCase, count] = dominant;
      const confidence = Math.min(0.95, count / total);

      if (confidence >= 0.6) {
        entries.push({
          category: "naming",
          pattern: `${entityType} use ${dominantCase} naming`,
          confidence,
          evidence,
          metadata: {
            entityType,
            dominantCase,
            counts: caseCounts,
            sampleSize: sample.length,
          },
        });
      }
    }

    return entries;
  },
};
```

### Test Pattern Detection (Project Structure)

```typescript
// src/extractors/static/project-structure.ts
// Satisfies EXTR-08: test file location, naming, framework detection
import { globby } from "globby";
import { ALWAYS_SKIP } from "../../utils/fs.js";
import type { Extractor } from "../types.js";

const TEST_PATTERNS = [
  { pattern: "**/*.test.{ts,tsx,js,jsx}", location: "co-located", style: "*.test.ts" },
  { pattern: "**/*.spec.{ts,tsx,js,jsx}", location: "co-located", style: "*.spec.ts" },
  { pattern: "test/**/*.{ts,tsx,js,jsx}", location: "test/ directory", style: "test/" },
  { pattern: "tests/**/*.{ts,tsx,js,jsx}", location: "tests/ directory", style: "tests/" },
  { pattern: "__tests__/**/*.{ts,tsx,js,jsx}", location: "__tests__/ directory", style: "__tests__/" },
];

export const projectStructureExtractor: Extractor = {
  name: "project-structure",
  async extract(ctx) {
    const entries = [];

    for (const { pattern, location, style } of TEST_PATTERNS) {
      const found = await globby(pattern, {
        cwd: ctx.projectPath,
        gitignore: true,
        ignore: [...ALWAYS_SKIP],
        onlyFiles: true,
      });

      if (found.length > 0) {
        entries.push({
          category: "testing" as const,
          pattern: `Test files in ${location} (${style})`,
          confidence: Math.min(0.95, 0.5 + found.length * 0.05),
          evidence: found.slice(0, 5).map((f) => ({ file: f, line: null })),
          metadata: { testFileCount: found.length, location, style },
        });
      }
    }

    return entries;
  },
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @iarna/toml for Cargo.toml | smol-toml | 2023 | @iarna/toml unmaintained for 6 years; smol-toml is the dominant npm TOML parser |
| tree-sitter for JS/TS AST | ts-morph | 2022+ | tree-sitter requires native bindings; ts-morph is pure JS and preferred for analysis-only use cases |
| babel-parser for AST | ts-morph | 2021+ | babel-parser lacks TypeScript type information; ts-morph wraps the real TypeScript compiler |
| detect-package-manager | lockfile presence check | Always | File existence is 5 lines; avoid the dependency |

**Still current:**
- js-yaml v4 is stable and widely used. No successor needed.
- ts-morph v27 is the current version (2025). API is stable.
- smol-toml v1.6 is the dominant TOML parser.

---

## Open Questions

1. **Extractor Result Deduplication**
   - What we know: Multiple extractors may emit similar conventions (e.g., package-json says "uses Vitest" and project-structure also detects test files matching vitest patterns)
   - What's unclear: How to deduplicate or merge without losing evidence references
   - Recommendation: The planner should decide: either the registry accepts duplicates (consumers deduplicate), or the runner merges by (category + pattern) key. A simple approach: if two entries have the same category + pattern substring, keep the higher-confidence one and merge their evidence.

2. **Non-JS/TS Project Code Pattern Analysis**
   - What we know: ts-morph only handles TypeScript and JavaScript. EXTR-04 (naming conventions) and EXTR-05 (import patterns) require AST analysis.
   - What's unclear: Should naming convention detection return empty for Python/Go/Rust projects, or should there be a regex-based fallback?
   - Recommendation: For Phase 2, return empty from naming/import extractors for non-TS/JS projects. The stack extractor still provides useful data. Regex-based naming for other languages is a future enhancement.

3. **Confidence Score Calibration**
   - What we know: A function naming convention found in 3 files should have lower confidence than one found in 300 files.
   - What's unclear: The exact formula for confidence scaling.
   - Recommendation: Use `min(0.95, count / total)` for proportion-based confidence, with a floor of 0.5 when detected (it exists) and 0 when absent. The `0.95` cap prevents false 100% certainty.

4. **StackInfo Population**
   - What we know: The registry has a `stack: StackInfo` field with `language`, `framework`, `testRunner`, `buildTool`, `packageManager`, `nodeVersion`.
   - What's unclear: Should extractors directly mutate `stack`, or derive it from `conventions` at the end?
   - Recommendation: Have the runner do a post-extraction pass to populate `stack` from the extracted `ConventionEntry` items with category "stack" and metadata keys `language`, `framework`, etc. Keep extractors pure (return only `ConventionEntry[]`); the runner handles registry field population.

---

## Sources

### Primary (HIGH confidence)

- ts-morph.com — [source files API](https://ts-morph.com/details/source-files), [imports API](https://ts-morph.com/details/imports), [adding source files](https://ts-morph.com/setup/adding-source-files), [performance](https://ts-morph.com/manipulation/performance)
- npm registry `curl` for ts-morph v27.0.2, js-yaml v4.1.1, smol-toml v1.6.0
- [smol-toml GitHub](https://github.com/squirrelchat/smol-toml) — TOML 1.1.0, actively maintained, benchmarks
- [js-yaml GitHub](https://github.com/nodeca/js-yaml) — 180M weekly downloads, `yaml.load()` API
- [ts-morph GitHub](https://github.com/dsherret/ts-morph) — v27.0.2, 2.8M weekly downloads
- `.planning/research/ARCHITECTURE.md` — extractor interface, ExtractionContext, parallel runner pattern
- `.planning/research/PITFALLS.md` — CP-3 (OOM), extractor phase pitfalls

### Secondary (MEDIUM confidence)

- [arxiv 2502.17749](https://arxiv.org/html/2502.17749v1) — Coding style feature extraction: 5-case naming classification, frequency counting approach, 4-character filter for short identifiers
- [ts-morph Issue #1653](https://github.com/dsherret/ts-morph/issues/1653) — `resolveSourceFileDependencies()` behavior difference v27.0.0
- WebSearch: lockfile → package manager mapping (npm/yarn/pnpm/bun confirmed with official docs)
- WebSearch: GitHub Actions YAML structure — `jobs.*.steps[].run` for command extraction

### Tertiary (LOW confidence)

- WebSearch: CI config command filtering heuristics — not from official sources, based on common knowledge of CI patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack (ts-morph, js-yaml, smol-toml): HIGH — verified from npm registry, GitHub, and official docs
- Extractor interface pattern: HIGH — directly from ARCHITECTURE.md (already researched)
- Naming convention detection approach: HIGH — supported by academic paper + ts-morph official API docs
- Import organization detection: HIGH — ts-morph official API docs confirm `getImportDeclarations()` + `getModuleSpecifierSourceFile()`
- CI config parsing: HIGH — GitHub Actions YAML structure is well-documented
- StackInfo population strategy: MEDIUM — open question on runner vs. extractor responsibility
- Confidence score formulas: MEDIUM — derived from reasoning, not empirically calibrated

**Research date:** 2026-02-28
**Valid until:** 2026-08-28 (ts-morph is in active development as v0.x analogue; check for breaking changes before extending)
