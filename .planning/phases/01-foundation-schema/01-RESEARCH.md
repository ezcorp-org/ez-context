# Phase 1: Foundation + Schema - Research

**Researched:** 2026-02-28
**Domain:** TypeScript project scaffolding, Zod schema design, ez-search bridge pattern, file traversal with .gitignore
**Confidence:** HIGH

---

## Summary

Phase 1 establishes everything downstream phases depend on: TypeScript project structure, build tooling, the Convention Registry schema (the IR), the ez-search bridge, and file traversal utilities. This research draws heavily from the pre-existing `.planning/research/` intel files (STACK.md, ARCHITECTURE.md, PITFALLS.md) which contain deep, verified research on the full project stack. Phase 1 needs only a subset of that stack.

The standard approach for this phase is: tsdown for building, Vitest for testing, ESLint 9 flat config for linting, Zod v4 for schema validation, globby v16 for file traversal with gitignore support, and a thin bridge adapter over `@ez-corp/ez-search`. All these choices are already locked in the STACK.md intel.

**One update from STACK.md:** STACK.md recommends `zod@^3.x` but Zod v4 is now stable and published as `zod@^4.0.0` with breaking API changes. The planner must decide whether to start on v4 or pin to v3. This research recommends v4 given it's a new project.

**Primary recommendation:** Scaffold as a single-package ESM-only TypeScript project using tsdown + Vitest + ESLint 9 flat config. Define the Convention Registry schema with Zod v4 using `z.infer<>` for all TypeScript types. Build the ez-search bridge as a thin wrapper (`core/ez-search-bridge.ts`) exposing only `ensureIndex()`, `search()`, `embed()`, and `getManifest()`. Implement file traversal via globby v16's `gitignore: true` option.

---

## Standard Stack

The full project stack is documented in `.planning/research/STACK.md`. Phase 1 uses only this subset:

### Core (Phase 1 only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.0.0 | Convention Registry schema + runtime validation | v4 is now stable (Aug 2025). 14x faster than v3, 57% smaller. Standard for TypeScript-first schema + type inference. |
| globby | ^16.1.1 | File traversal respecting .gitignore | 62M weekly downloads. Built-in `gitignore: true` option. ESM-only. Wraps fast-glob with .gitignore parsing. Passes ignore rules to fast-glob for directory-skip optimization (perf critical for node_modules). |
| @ez-corp/ez-search | (required dep) | Vector indexing and search | The reason ez-context exists. Bridge wraps its JS/TS API directly. |

### Dev Tooling (Phase 1 scaffolding)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsdown | ^0.20.3 | Build TypeScript to ESM | Official tsup successor. Powered by Rolldown (Rust). ESM-first. tsup is unmaintained. |
| tsx | latest | Run TypeScript directly in dev | `tsx src/cli.ts` — no build step needed during development. |
| vitest | ^4.0.18 | Testing | Native ESM + TypeScript, zero config. v4.0 stable Jan 2026. |
| typescript | ~5.7 | TypeScript compiler | Required by tsdown and Vitest. |
| @types/node | latest | Node.js type definitions | Required for fs, path, process, etc. |
| typescript-eslint | latest | ESLint 9 TypeScript rules | Unified package for flat config. |
| eslint | ^9.x | Linting | Flat config is default in v9. |
| @eslint/js | latest | ESLint recommended rules | Required with flat config. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| zod v4 | zod v3 | v3 still works but deprecated. v4 has breaking API changes (see pitfalls). New project should start on v4. |
| globby | fast-glob directly | fast-glob has no built-in .gitignore support. Must manually parse and apply patterns. Not worth it. |
| tsdown | tsup | tsup is unmaintained as of late 2025. Maintainers explicitly recommend tsdown. |
| tsdown | tsc directly | tsc doesn't bundle, no tree-shaking, slower. |

**Installation:**

```bash
# Runtime dependencies (Phase 1 subset)
npm install zod@^4.0.0 globby@^16.1.1 @ez-corp/ez-search

# Dev dependencies
npm install -D tsdown@^0.20 tsx vitest@^4 typescript@~5.7 @types/node \
  eslint @eslint/js typescript-eslint
```

---

## Architecture Patterns

The full architecture is documented in `.planning/research/ARCHITECTURE.md`. Phase 1 establishes the foundation layers:

### Recommended Project Structure (Phase 1 scope)

```
ez-context/
├── src/
│   ├── core/
│   │   ├── schema.ts            # Zod schemas + z.infer<> types (the IR contract)
│   │   ├── registry.ts          # ConventionRegistry builder/aggregator
│   │   └── ez-search-bridge.ts  # Thin adapter over @ez-corp/ez-search
│   └── utils/
│       └── fs.ts                # File traversal, gitignore-aware listing
├── test/
│   ├── core/
│   │   ├── schema.test.ts
│   │   └── ez-search-bridge.test.ts
│   └── utils/
│       └── fs.test.ts
├── tsdown.config.ts
├── vitest.config.ts
├── eslint.config.js             # Flat config (not .eslintrc)
├── tsconfig.json
└── package.json
```

The full `src/` layout (extractors, emitters, drift, etc.) is in ARCHITECTURE.md. Phase 1 only creates `core/` and `utils/`.

### Pattern 1: Schema-First Types with Zod v4

**What:** Define all shared TypeScript types by writing Zod schemas first, then extracting types via `z.infer<>`. Never write types manually and separately.

**When to use:** All data structures in `core/schema.ts` — ConventionRegistry, ConventionEntry, StackInfo, ArchitectureInfo, etc.

**Why:** Single source of truth for runtime validation AND compile-time types. No drift between TypeScript interface and Zod schema.

**Example:**
```typescript
// Source: https://zod.dev/v4
import { z } from "zod";

// Define schema first
export const EvidenceRefSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().nullable(),
});

export const ConventionEntrySchema = z.object({
  category: z.enum([
    'stack', 'naming', 'architecture',
    'error_handling', 'testing', 'imports', 'other'
  ]),
  pattern: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const StackInfoSchema = z.object({
  language: z.string(),
  framework: z.string().optional(),
  testRunner: z.string().optional(),
  buildTool: z.string().optional(),
});

export const ArchitectureInfoSchema = z.object({
  pattern: z.string().optional(),
  layers: z.array(z.string()),
});

export const ConventionRegistrySchema = z.object({
  version: z.string(),
  projectPath: z.string(),
  generatedAt: z.string().datetime(),
  stack: StackInfoSchema,
  conventions: z.array(ConventionEntrySchema),
  architecture: ArchitectureInfoSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Infer TypeScript types from schemas — don't write them separately
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ConventionEntry = z.infer<typeof ConventionEntrySchema>;
export type ConventionRegistry = z.infer<typeof ConventionRegistrySchema>;
export type StackInfo = z.infer<typeof StackInfoSchema>;
export type ArchitectureInfo = z.infer<typeof ArchitectureInfoSchema>;
```

### Pattern 2: Bridge Adapter for ez-search

**What:** A thin wrapper `core/ez-search-bridge.ts` that exposes only what ez-context needs from `@ez-corp/ez-search`. Does not add a heavy abstraction layer.

**When to use:** All interaction with ez-search goes through this file. No direct imports of `@ez-corp/ez-search` outside `ez-search-bridge.ts`.

**Why:** Isolates ez-context from ez-search API changes. Enables mocking in tests. Makes the dependency explicit and narrow. Phase 1 needs: `ensureIndex()`, `search()`, `embed()`, `getManifest()`.

**Example (pattern — adjust to actual @ez-corp/ez-search API):**
```typescript
// src/core/ez-search-bridge.ts
import { createEzSearch, type EzSearchOptions } from "@ez-corp/ez-search";

export interface EzSearchBridge {
  ensureIndex(projectPath: string): Promise<void>;
  hasIndex(projectPath: string): Promise<boolean>;
  search(vector: number[], k: number): Promise<SearchResult[]>;
  embed(text: string): Promise<number[]>;
  getManifest(projectPath: string): Promise<FileManifest>;
}

export interface SearchResult {
  file: string;
  chunk: string;
  score: number;
}

export interface FileManifest {
  files: string[];
  lastIndexed: string;
}

export async function createBridge(options?: EzSearchOptions): Promise<EzSearchBridge> {
  const client = await createEzSearch(options);

  return {
    async hasIndex(projectPath: string): Promise<boolean> {
      // Check for .ez-search/ directory in projectPath
      // EXTR-10: auto-trigger indexing if no index exists
      const { existsSync } = await import("node:fs");
      return existsSync(`${projectPath}/.ez-search`);
    },

    async ensureIndex(projectPath: string): Promise<void> {
      if (!(await this.hasIndex(projectPath))) {
        await client.index(projectPath);
      }
    },

    async search(vector: number[], k: number): Promise<SearchResult[]> {
      return client.search(vector, k);
    },

    async embed(text: string): Promise<number[]> {
      return client.embed(text);
    },

    async getManifest(projectPath: string): Promise<FileManifest> {
      return client.getManifest(projectPath);
    },
  };
}
```

**Note:** The exact `@ez-corp/ez-search` API is unknown. The bridge pattern means the implementation can be adjusted to match the real API without touching any consumers.

### Pattern 3: File Traversal with Automatic gitignore + Hardcoded Exclusions

**What:** File listing utility in `utils/fs.ts` using globby with `gitignore: true` plus explicit ignore patterns for `node_modules/`, `dist/`, and `generated/`.

**When to use:** Any time ez-context needs to enumerate project files (INTG-04 requirement).

**Example:**
```typescript
// src/utils/fs.ts
import { globby, isGitIgnored } from "globby";
import { join } from "node:path";

// Always-skip directories regardless of .gitignore contents
const ALWAYS_SKIP = [
  "**/node_modules/**",
  "**/dist/**",
  "**/generated/**",
  "**/.ez-search/**",
  "**/.ez-context/**",
  "**/.git/**",
];

export interface ListFilesOptions {
  cwd: string;
  extensions?: string[];
  additionalIgnore?: string[];
}

export async function listProjectFiles(options: ListFilesOptions): Promise<string[]> {
  const { cwd, extensions = ["ts", "js", "json", "md"], additionalIgnore = [] } = options;

  const pattern = extensions.length === 1
    ? `**/*.${extensions[0]}`
    : `**/*.{${extensions.join(",")}}`;

  return globby(pattern, {
    cwd,
    gitignore: true,                          // respects .gitignore (INTG-04)
    ignore: [...ALWAYS_SKIP, ...additionalIgnore],
    onlyFiles: true,
    followSymbolicLinks: false,
  });
}

// Programmatic path check — useful for incremental scanning
export async function isIgnored(filePath: string, cwd: string): Promise<boolean> {
  const checkIgnored = await isGitIgnored({ cwd });
  const relative = filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;

  // Check .gitignore first
  if (checkIgnored(relative)) return true;

  // Check hardcoded skips
  return ALWAYS_SKIP.some(pattern => {
    const simplified = pattern.replace(/\*\*/g, "").replace(/\//g, "");
    return relative.includes(simplified);
  });
}
```

### Pattern 4: ESM-Only TypeScript Configuration

**What:** `"type": "module"` in package.json, `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` in tsconfig.json, `.js` extensions in all local imports.

**Why:** Phase 1 decision locks ESM-only TypeScript. NodeNext is the correct module resolution for Node.js ESM projects (not bundler-centric).

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**tsconfig.test.json** (separate for tests to include `test/` dir):
```json
{
  "extends": "./tsconfig.json",
  "include": ["src/**/*", "test/**/*"],
  "compilerOptions": {
    "noEmit": true
  }
}
```

**package.json** (key fields):
```json
{
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "engines": {
    "node": ">=20.19.0"
  }
}
```

### Pattern 5: ESLint 9 Flat Config

**What:** `eslint.config.js` using `tseslint.config()` from the unified `typescript-eslint` package.

**Note:** As of 2026, `tseslint.config()` is deprecated in favor of ESLint core's `defineConfig()`. Use `defineConfig` from `"eslint/config"` instead. Verify current API when scaffolding.

**Example:**
```javascript
// eslint.config.js
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "**/*.d.ts"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
    },
  }
);
```

### Pattern 6: Vitest Configuration for ESM + TypeScript

**What:** Minimal `vitest.config.ts` for ESM-only TypeScript. Vitest supports ESM + TypeScript natively — zero Babel or ts-jest needed.

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,             // Explicit imports preferred (no global describe/it/expect)
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
    },
  },
});
```

**package.json scripts:**
```json
{
  "scripts": {
    "build": "tsdown src/index.ts",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ test/",
    "typecheck": "tsc --noEmit -p tsconfig.test.json"
  }
}
```

### Anti-Patterns to Avoid

- **Manual TypeScript types separate from Zod schemas:** Define Zod schemas first, infer types. Never maintain both manually — they will diverge.
- **Direct `@ez-corp/ez-search` imports outside bridge:** All callers use `EzSearchBridge` interface. Enables mocking and isolates API surface.
- **`"module": "ESNext"` in tsconfig:** Sounds modern but pushes resolution responsibility to bundler. For Node.js ESM, use `NodeNext`.
- **Relative imports without `.js` extension:** NodeNext module resolution requires explicit `.js` extensions even in TypeScript source. `import { foo } from "./schema.js"` (not `"./schema"`).
- **`zod@^3.x` import with v4 installed:** Zod v4 import is still `import { z } from "zod"` but the API has breaking changes from v3. Don't mix patterns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| .gitignore parsing and file filtering | Custom ignore rule parser | globby `gitignore: true` | .gitignore spec is complex (negations, subdirectory scoping, case sensitivity, glob edge cases). globby uses `ignore` package which is verified against `git check-ignore`. |
| TypeScript type inference from schemas | Separate interfaces + validation | `z.infer<typeof Schema>` | Type and validator will always be in sync. Less code. No maintenance burden. |
| ESM module bundling | Custom esbuild config | tsdown | .d.ts generation, source maps, clean output — all handled. |
| Runtime TypeScript execution in dev | Build step before every test | tsx | Drop-in `node` replacement. Instant, no config. |
| Glob pattern matching | Custom file walker | globby / fast-glob | Edge cases in symlinks, depth limits, negation patterns. |

**Key insight:** The gitignore spec has dozens of edge cases (directory matching, negation, ordering, case sensitivity on different OS). The `ignore` package (used by globby internally) is the canonical Node.js implementation, verified against actual git behavior. Never reimplement this.

---

## Common Pitfalls

### Pitfall 1: Zod v3 vs v4 API Confusion

**What goes wrong:** STACK.md recommends `zod@^3.x`. Zod v4 is now stable at `zod@^4.0.0` with breaking API changes. Starting on the wrong version wastes time migrating or creates tech debt.

**Key v4 breaking changes affecting Phase 1:**
- `z.string().email()` → `z.email()` (top-level function, not method)
- `z.string().uuid()` → `z.uuid()`
- `invalid_type_error` / `required_error` params dropped — use unified `error` param
- `.strict()` method → use `z.strictObject()` function
- `error.errors` → `error.issues` (ZodError shape changed)
- `z.record()` now requires two arguments: `z.record(z.string(), z.number())`

**How to avoid:** Start on v4 from day one. Import as `import { z } from "zod"` (same path, different API). Use `z.safeParse()` not `z.parse()` for structured error handling.

**Warning signs:** Code that calls `.email()` on a string schema, or uses `error.errors` instead of `error.issues`.

### Pitfall 2: NodeNext Module Resolution Requires `.js` Extensions

**What goes wrong:** TypeScript with `"moduleResolution": "NodeNext"` requires `.js` extensions in relative imports in source files, even though you're writing `.ts`. This is confusing and causes "Cannot find module" errors at runtime.

**Why it happens:** NodeNext follows Node.js ESM resolution rules exactly. Node resolves imports as-written. TypeScript emits `.ts` → `.js` but leaves import paths unchanged.

**How to avoid:** Always write `import { foo } from "./schema.js"` in source (not `"./schema"` or `"./schema.ts"`). This is correct — TypeScript knows `.schema.js` maps to `./schema.ts`.

**Warning signs:** Works in `tsc --noEmit` but fails at runtime with "Cannot find module".

### Pitfall 3: Zod Schema Definitions Not Re-Used (Inline Objects)

**What goes wrong:** Defining Zod schemas inline inside functions instead of at module level. This recreates schema objects on every call — not hugely expensive but wasteful and prevents reuse.

**How to avoid:** Define all schemas at module top-level. Export them. Use `z.infer<>` once per schema at module level.

### Pitfall 4: ez-search Bridge Mocking in Tests

**What goes wrong:** Tests that import `@ez-corp/ez-search` directly can't mock the bridge behavior. Tests that integrate with the real ez-search require an existing index to exist.

**How to avoid:** Design bridge as an interface (`EzSearchBridge`) from the start. Tests pass a mock implementation. The bridge adapter is the only code that touches the real `@ez-corp/ez-search`. Use Vitest's `vi.mock()` at the module level to mock the bridge.

**Example test pattern:**
```typescript
// test/core/pipeline.test.ts
import { createMockBridge } from "../helpers/mock-bridge.js";

const bridge = createMockBridge({
  hasIndex: async () => true,
  search: async (vec, k) => mockResults.slice(0, k),
});
```

### Pitfall 5: globby `ignore` vs `gitignore` Options Are Different Things

**What goes wrong:** Confusing globby's `ignore` option (patterns to exclude matched files) with `gitignore` option (enable .gitignore parsing). They are different.

- `gitignore: true` — reads and respects `.gitignore` files
- `ignore: ['**/node_modules/**']` — additional patterns on top

**How to avoid:** Always use both: `gitignore: true` for .gitignore compliance, plus explicit `ignore` for `node_modules/`, `dist/`, `generated/` (INTG-04 requires these regardless of .gitignore state).

---

## Code Examples

### Convention Registry Schema (complete Phase 1 schema)

```typescript
// src/core/schema.ts
// Source: Zod v4 docs (https://zod.dev/v4), ARCHITECTURE.md IR design
import { z } from "zod";

export const ConventionCategorySchema = z.enum([
  "stack",
  "naming",
  "architecture",
  "error_handling",
  "testing",
  "imports",
  "other",
]);

export const EvidenceRefSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().nullable(),
});

export const ConventionEntrySchema = z.object({
  id: z.string().uuid(),
  category: ConventionCategorySchema,
  pattern: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const StackInfoSchema = z.object({
  language: z.string(),
  framework: z.string().optional(),
  testRunner: z.string().optional(),
  buildTool: z.string().optional(),
  packageManager: z.string().optional(),
  nodeVersion: z.string().optional(),
});

export const ArchitectureInfoSchema = z.object({
  pattern: z.string().optional(),
  layers: z.array(z.string()),
  entryPoints: z.array(z.string()).optional(),
});

export const ConventionRegistrySchema = z.object({
  version: z.literal("1"),
  projectPath: z.string(),
  generatedAt: z.string().datetime(),
  stack: StackInfoSchema,
  conventions: z.array(ConventionEntrySchema),
  architecture: ArchitectureInfoSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Types inferred from schemas — no manual type definitions
export type ConventionCategory = z.infer<typeof ConventionCategorySchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ConventionEntry = z.infer<typeof ConventionEntrySchema>;
export type StackInfo = z.infer<typeof StackInfoSchema>;
export type ArchitectureInfo = z.infer<typeof ArchitectureInfoSchema>;
export type ConventionRegistry = z.infer<typeof ConventionRegistrySchema>;
```

### Validating Sample Convention Data

```typescript
// test/core/schema.test.ts
// Source: Zod v4 .safeParse() pattern (https://zod.dev/v4)
import { describe, it, expect } from "vitest";
import { ConventionRegistrySchema } from "../../src/core/schema.js";

describe("ConventionRegistry schema", () => {
  it("validates a minimal valid registry", () => {
    const sample = {
      version: "1",
      projectPath: "/home/user/myproject",
      generatedAt: new Date().toISOString(),
      stack: { language: "TypeScript" },
      conventions: [],
      architecture: { layers: [] },
    };

    const result = ConventionRegistrySchema.safeParse(sample);
    expect(result.success).toBe(true);
  });

  it("rejects registry with invalid confidence score", () => {
    const sample = {
      version: "1",
      projectPath: "/home/user/myproject",
      generatedAt: new Date().toISOString(),
      stack: { language: "TypeScript" },
      conventions: [{
        id: "550e8400-e29b-41d4-a716-446655440000",
        category: "stack",
        pattern: "Hono web framework",
        confidence: 1.5,  // INVALID: > 1
        evidence: [],
      }],
      architecture: { layers: [] },
    };

    const result = ConventionRegistrySchema.safeParse(sample);
    expect(result.success).toBe(false);
    // v4: error.issues (not error.errors)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("confidence");
    }
  });
});
```

### File Traversal with .gitignore

```typescript
// Source: globby v16 docs (https://github.com/sindresorhus/globby)
import { globby } from "globby";

const files = await globby("**/*.{ts,js}", {
  cwd: projectPath,
  gitignore: true,        // respects .gitignore (INTG-04)
  ignore: [
    "**/node_modules/**", // INTG-04: skip node_modules
    "**/dist/**",         // INTG-04: skip dist
    "**/generated/**",    // INTG-04: skip generated
    "**/.git/**",
    "**/.ez-search/**",
  ],
  onlyFiles: true,
  followSymbolicLinks: false,
});
```

### tsdown Configuration

```typescript
// tsdown.config.ts
// Source: https://tsdown.dev/
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  sourcemap: true,
  target: "node20",
  outDir: "dist",
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tsup (esbuild-based) | tsdown (Rolldown-based) | Late 2025 | tsup is unmaintained. Use tsdown. |
| Zod v3 (`zod@^3`) | Zod v4 (`zod@^4`) | Aug 2025 | v4 is stable. 14x faster. Breaking API changes. |
| ESLint legacy `.eslintrc` | ESLint 9 flat config `eslint.config.js` | ESLint 9 (stable) | Flat config is default. `.eslintrc` no longer works. |
| Jest for testing | Vitest | 2024-2025 | Vitest v4 stable Jan 2026. Native ESM. No config needed. |
| `"moduleResolution": "node"` | `"moduleResolution": "NodeNext"` | TypeScript 4.7+ | Required for correct Node.js ESM resolution. |
| `tseslint.config()` helper | `defineConfig()` from `"eslint/config"` | 2025 | `tseslint.config()` deprecated. Verify current API. |

**Deprecated/outdated:**
- `zod@^3.x`: Deprecated. v4 is stable and recommended for new projects.
- `tsup`: Unmaintained as of late 2025. Maintainers redirect to tsdown.
- `.eslintrc.json` / `.eslintrc.js`: No longer works in ESLint 9. Must use `eslint.config.js`.
- `"moduleResolution": "node"`: Incorrect for ESM projects. Use `NodeNext`.

---

## Open Questions

1. **@ez-corp/ez-search API surface**
   - What we know: It's a published npm package exposing a JS/TS API. Phase 1 bridge needs: check for index, trigger indexing, basic search/query.
   - What's unclear: The actual function names, parameter types, and return types are unknown. The bridge will need to adapt to whatever the real API provides.
   - Recommendation: When implementing `ez-search-bridge.ts`, start by reading `@ez-corp/ez-search`'s type definitions (`node_modules/@ez-corp/ez-search/dist/index.d.ts`). Build the bridge interface to match what is actually available, not what is assumed here.

2. **Zod v4 migration from STACK.md recommendation**
   - What we know: STACK.md recommended `zod@^3.x`. Zod v4 is now stable with breaking changes.
   - What's unclear: Whether the team wants to start on v4 or pin to v3 for stability.
   - Recommendation: Start on v4. It's a new project — no migration cost. The breaking changes primarily affect error customization and string validators. The Phase 1 schema is simple enough that v4 patterns are straightforward.

3. **`tseslint.config()` deprecation status**
   - What we know: One source indicates `tseslint.config()` was deprecated in favor of `defineConfig()` from `"eslint/config"`. Another source still shows `tseslint.config()` as current.
   - What's unclear: Exact current status and version where deprecation occurred.
   - Recommendation: Check `typescript-eslint` changelog when scaffolding. Either helper works — use whichever is current.

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/STACK.md` — Full verified technology stack for ez-context
- `.planning/research/ARCHITECTURE.md` — Complete architecture patterns, component boundaries, module layout
- `.planning/research/PITFALLS.md` — Critical/moderate/minor pitfalls with prevention strategies
- [Zod v4 release notes](https://zod.dev/v4) — v4 stable, current import path, breaking changes
- [Zod v4 changelog](https://zod.dev/v4/changelog) — Full breaking change list
- [globby GitHub](https://github.com/sindresorhus/globby) — `gitignore: true` option, `isGitIgnored` API
- [typescript-eslint.io](https://typescript-eslint.io/packages/typescript-eslint/) — ESLint 9 flat config setup

### Secondary (MEDIUM confidence)

- [tsdown.dev](https://tsdown.dev/) — Official tsdown docs, confirms tsup unmaintained
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) — v4 stable Jan 2026, ESM native
- [TypeScript ESM 2025 guide (2ality)](https://2ality.com/2025/02/typescript-esm-packages.html) — NodeNext module resolution
- [ESLint 9 migration guide](https://jeffbruchado.com.br/en/blog/eslint-9-flat-config-migration-configuration-guide-2025) — Flat config pattern

### Tertiary (LOW confidence)

- WebSearch: Zod v4 best practices 2026 — General guidance on schema patterns
- WebSearch: fast-glob node_modules skip 2025 — globby performance characteristics

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified from existing STACK.md research + current Zod v4/tsdown status
- Architecture: HIGH — Detailed in ARCHITECTURE.md, validated patterns from API Extractor and Drift
- Schema design: HIGH — Follows Zod v4 official patterns, schema shapes from ARCHITECTURE.md IR
- ez-search bridge: MEDIUM — Bridge pattern is HIGH confidence, actual API surface is unknown
- File traversal: HIGH — globby v16 `gitignore: true` is current, verified
- Pitfalls: HIGH — From PITFALLS.md (well-sourced) + specific v4/ESM findings

**Research date:** 2026-02-28
**Valid until:** 2026-09-01 (stable libraries; tsdown is v0.x so check for breaking changes before that date)
