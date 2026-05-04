# Technology Stack

**Project:** ez-context
**Researched:** 2026-02-28
**Overall confidence:** HIGH

---

## Recommended Stack

### CLI Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Commander.js | ^14.0.3 | Command parsing, subcommands, help generation | Already chosen in project spec. 116K dependents, v15 planned May 2026. Lightweight, zero-dependency, battle-tested. Perfect for a non-interactive CLI that runs commands (`generate`, `drift`, `update`, `watch`). Node v20+ required, aligned with our target. | HIGH |

**What NOT to use:**
- **oclif** -- Heavyweight framework designed for Heroku-style plugin CLIs. Massive dependency tree, opinionated project structure. Overkill for a focused tool with 4 commands.
- **Ink (React for CLI)** -- Tempting for watch mode UI, but ez-context is not a dashboard. It runs commands and exits. Ink adds React as a dependency for terminal rendering you do not need. If watch mode later needs a persistent UI, revisit then.
- **yargs** -- Comparable to Commander but Commander already won the ecosystem. Commander has cleaner TypeScript support and a simpler API for subcommands.
- **Clipanion** -- Yarn's CLI framework. Good type safety but smaller community, less documentation. No compelling advantage over Commander for this use case.

### Terminal Output

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| chalk | ^5.4.x | Colored terminal output | ESM-native since v5. Zero dependencies. Industry standard for terminal colors. | HIGH |
| ora | ^8.x | Spinner for long operations | Clean single-spinner for `generate` and `drift` operations. Pairs with chalk. | MEDIUM |

**What NOT to use:**
- **listr2** -- Task list manager. Useful when you have 5+ concurrent tasks with visible progress. ez-context's pipeline is sequential (extract -> cluster -> template). A single spinner with status updates is cleaner.
- **cli-progress** -- Progress bars. Not needed unless indexing large repos, which ez-search handles, not ez-context.

### Template Engine

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Eta | ^4.5.1 | Render convention registry into context files | Written in TypeScript, 0 dependencies, 3.5KB minzipped. Actively maintained (v4.5.1 published Dec 2025). Supports async templates, partials, layouts, custom delimiters. Faster than Handlebars and EJS in benchmarks. File-based template loading with `views` directory. Perfect for rendering structured JSON into multiple output formats. 1.2M weekly downloads. | HIGH |

**Why Eta over Handlebars:**
- Handlebars v4.7.8 was last published 3 years ago. Effectively unmaintained. While stable, choosing a stagnant dependency for a new project is avoidable risk.
- For generating markdown (not HTML), Handlebars' auto-escaping HTML is counterproductive -- we want raw string output by default, which is Eta's default behavior.
- Eta allows embedded JS expressions directly -- useful when templates need conditional logic based on convention confidence scores, array filtering, etc. Handlebars requires custom helpers for everything beyond basic iteration.
- Eta is TypeScript-native (Handlebars ships types but is written in JS) with zero dependencies vs Handlebars' dependency tree.
- Eta supports async rendering natively, relevant if template data comes from async extractors.

**Why Eta over EJS:**
- Eta was designed as "EJS done right" -- fixes EJS parsing edge cases, adds partials/layouts, better error messages with stack traces. Faster in benchmarks.

**Why Eta over raw string interpolation:**
- Template files should be user-customizable (the architecture doc mentions this). A template engine with file-based loading (`eta.render("./claude-md", registry)`) enables this. Raw template literals would require code changes to customize output.

### File Watching

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| chokidar | ^5.0.0 | Watch mode for file system events | v5.0.0 (Nov 2025) is ESM-only, requires Node.js v20.19+ -- both align with project requirements. Normalizes cross-platform fs.watch inconsistencies. Handles macOS filename reporting, recursive watching on Linux, atomic writes, and chunked writes. Used by ~30M repos. Single dependency. Rewritten in TypeScript. | HIGH |

**Why NOT raw `fs.watch`:**
- `fs.watch` does not report filenames on macOS.
- Does not support recursive watching reliably on Linux.
- Reports most changes as "rename" instead of add/change/unlink.
- Often reports events twice.
- Chokidar wraps `fs.watch` and fixes all of these issues with minimal overhead.

### File System Utilities

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| globby | ^16.1.1 | Glob matching + .gitignore parsing | 62M weekly downloads, built-in `.gitignore` parsing via `gitignore: true` option. ESM-only. Wraps fast-glob with convenience APIs. Passes ignore patterns to fast-glob for directory-skip optimization. Key utility: `isGitIgnored()` for programmatic filtering. | HIGH |
| gray-matter | ^4.0.3 | YAML frontmatter parsing | De facto standard for parsing YAML frontmatter from markdown files. Used by Hugo, Gatsby, Astro, etc. Needed for reading/writing context files with frontmatter metadata. | HIGH |

### Clustering Algorithms

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ml-kmeans | ^7.0.0 | K-means for architecture recognition, refinement | Maintained by Zakodium (mljs org). v7.0.0 released ~3 months ago. Returns centroids, convergence info, iteration count. Supports k-means++ initialization and custom distance functions. Use for cases where cluster count is known (e.g., "find 5 architecture layers"). 43 dependents, MIT license. | MEDIUM |
| In-house DBSCAN | N/A | DBSCAN clustering for convention extraction | **Implement in-house (~80-100 lines of TypeScript).** DBSCAN is a well-documented, simple algorithm. The only npm option (`density-clustering` v1.3.0) was last published 10 years ago and is unmaintained. Writing our own gives us: cosine distance built-in, TypeScript types, ESM native, zero stale deps. | HIGH (for the approach) |

**Clustering strategy per architecture doc:**
- **DBSCAN first** for initial convention discovery (unknown number of conventions, need noise tolerance). Custom implementation with cosine distance.
- **K-means** for refinement when cluster count is known from prior runs or user config. Use `ml-kmeans`.
- Both operate on embedding vectors from ez-search's Zvec.

**What NOT to use:**
- **density-clustering** -- v1.3.0, unmaintained for 10 years. CJS-only, would need interop. The algorithm is trivial enough to implement in-house with better types and ESM support.
- **TensorFlow.js** -- Massive dependency for clustering that can be done with 80 lines of code.
- **scikit-learn via Python subprocess** -- Breaks the "zero network calls, pure Node" constraint and adds Python as a runtime dependency.

### AST Parsing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| ts-morph | ^27.x | Extract identifiers, naming conventions, import patterns | Wraps the TypeScript Compiler API with a fluent, chainable interface. 2.8M weekly downloads. Actively maintained (v27.0.2, ~4 months ago). Perfect for "counting problem" analysis: identifier naming (camelCase vs snake_case), import patterns, export structures. Pure JS/TS, no native deps. | HIGH |

**Why ts-morph over raw TypeScript Compiler API:**
- The raw TS Compiler API is notoriously difficult to use. ts-morph provides `sourceFile.getDescendantsOfKind()`, `getIdentifiers()`, `getImportDeclarations()` etc. with proper TypeScript types.
- For the naming convention detection described in the architecture ("camelCase vs snake_case is a counting problem"), ts-morph makes this trivial: get all identifiers, categorize by naming pattern, count.

**Why ts-morph over tree-sitter:**
- tree-sitter excels at incremental parsing for editors. ez-context does batch analysis, not real-time editing support.
- tree-sitter requires native bindings (WASM or N-API), adding complexity to npm distribution and standalone binary generation. ts-morph is pure JavaScript/TypeScript.
- ez-context already uses the TypeScript ecosystem -- ts-morph integrates naturally.

**When to add tree-sitter later:**
- If ez-context expands to support Python, Rust, Go, etc., tree-sitter becomes necessary because ts-morph only handles TS/JS. This would be a future phase concern. The architecture supports swappable extractors.

**What NOT to use:**
- **babel-parser / acorn** -- JavaScript-focused, no TypeScript type information.
- **@swc/core / OXC** -- Designed for high-performance transpilation, not AST analysis. API is less ergonomic for traversal than ts-morph. Overkill for our narrow use case (we're not parsing in a hot loop).

### Testing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vitest | ^4.0.18 | Unit tests, integration tests, snapshots | 31M weekly downloads. Native ESM + TypeScript support without config. 10-20x faster than Jest in watch mode. Uses Vite's transform pipeline so TS/ESM just works. State of JS 2024 shows Vitest overtaking Jest in developer satisfaction. v4.0 stable since Jan 2026. Built-in coverage, mocking, snapshot testing. | HIGH |

**Why NOT Jest:**
- ESM remains experimental in Jest. Requires `--experimental-vm-modules` flag and `jest.unstable_mockModule` for ESM mocking.
- Requires `ts-jest` or Babel for TypeScript, adding configuration overhead.
- Jest 30 (June 2025) improved but kept its CJS-first architecture.
- For a new ESM-first TypeScript project, Jest creates friction that Vitest eliminates.

**Why NOT node:test:**
- Missing snapshot testing, rich mocking utilities, and polished output. Good for simple projects; ez-context needs to test clustering outputs, template rendering, file generation -- Vitest's snapshot testing and module mocking are essential.

### Build / Bundle

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsdown | ^0.20.3 | Bundle TypeScript into distributable ESM | **Successor to tsup** (tsup is officially unmaintained as of late 2025, recommends tsdown). Powered by Rolldown (Rust-based, faster than esbuild for bundling). ESM-first, generates .d.ts type declarations, supports dual ESM+CJS output. Zero-config for standard setups. Node v20.19+ required (matches our target). From the VoidZero team (Vite/Vitest/Rolldown ecosystem). Automated migration from tsup via `npx tsdown migrate`. 91 dependents and growing. | MEDIUM |
| tsx | latest | Run TypeScript directly during development | `tsx src/cli.ts [args]` for dev without building. Uses esbuild under the hood. Drop-in replacement for `node` that understands TypeScript. | HIGH |

**IMPORTANT:** tsup v8.5.1 is officially no longer maintained. The maintainers explicitly recommend tsdown. Starting a new project on an unmaintained bundler is inadvisable.

**Why tsdown over tsup:** tsup is unmaintained. tsdown is the official successor with better performance (Rolldown vs esbuild) and ESM-first design.

**Why tsdown over raw esbuild:** No .d.ts generation, no dual-format output without manual config. tsdown wraps Rolldown and adds the DX layer.

**Why tsdown over unbuild:** unbuild (233K weekly downloads) is Nuxt/UnJS ecosystem-specific. tsdown is from the broader Vite/VoidZero ecosystem with more momentum.

**Caveat:** tsdown is v0.x (pre-1.0). API may change. Mitigation: backed by VoidZero (well-funded), active development, and the migration path from tsup is automated.

**Build pipeline:**
```
Development:  tsx src/cli.ts [args]       -- instant, no build step
Production:   tsdown src/cli.ts           -- bundled output in dist/
```

### Distribution (Standalone Binary)

| Technology | Purpose | Why | Confidence |
|------------|---------|-----|------------|
| `bun build --compile` | Primary: standalone binary | Anthropic ships Claude Code as a Bun-compiled binary to millions of developers. Proven at scale. Single command, cross-platform output. Bun was acquired by Anthropic in Dec 2025, signaling long-term investment. Works on existing npm projects without rewriting -- you layer Bun compilation on top of your npm package. | MEDIUM |
| Node.js SEA (`--build-sea`) | Future: standalone binary | Node v25.5+ (Jan 2026) added `--build-sea` for one-step SEA generation. No external tools needed. **Note:** Only available in Node v25+ (Current), not v20 LTS. Won't be in LTS until ~v26. Monitor for when it hits LTS. | LOW (for now) |

**Binary strategy:** Ship npm package as primary distribution. Use `bun build --compile` for standalone binary. Keep Node.js SEA as a future option when it lands in LTS.

**Why NOT vercel/pkg or @yao-pkg/pkg:** pkg has known issues with native modules, dynamic requires, and is showing its age. Bun compile and Node SEA are the modern paths forward.

---

## Supporting Libraries

| Library | Version | Purpose | When Needed | Confidence |
|---------|---------|---------|-------------|------------|
| zod | ^3.x | Validate convention registry schema, CLI input, config files | Phase 1 -- schema validation for the convention registry JSON structure | HIGH |
| cosmiconfig | ^9.x | Load `.ez-contextrc`, `ez-context.config.js`, etc. | Phase 1 -- user configuration loading from standard locations | HIGH |
| yaml | ^2.x | YAML serialization | Phase 1 -- generate YAML frontmatter for output files, more control than gray-matter for writing | MEDIUM |
| diff | ^7.x | Text diffing | Phase 2 -- showing what changed during `update` command (before/after context file sections) | MEDIUM |

---

## Full Installation

```bash
# Core runtime dependencies
npm install commander@^14 eta@^4 chokidar@^5 globby@^16 ts-morph@^27 ml-kmeans@^7 gray-matter@^4 chalk@^5 ora@^8 zod@^3 cosmiconfig@^9 yaml@^2

# Dev dependencies
npm install -D tsdown@^0.20 tsx vitest@^4 @types/node typescript@~5.7
```

**Note:** DBSCAN is implemented in-house (~80-100 lines), no dependency needed.

---

## Version Compatibility Matrix

| Dependency | Min Node.js | Module Format | TypeScript Types |
|------------|-------------|---------------|------------------|
| Commander 14 | v20 | ESM + CJS (dual) | Built-in |
| Eta 4 | v14+ | ESM + CJS (dual) | Built-in |
| Chokidar 5 | **v20.19+** | ESM-only | Built-in |
| globby 16 | v18+ | ESM-only | Built-in |
| ts-morph 27 | v16+ | ESM + CJS (dual) | Built-in |
| ml-kmeans 7 | v14+ | ESM + CJS | Built-in |
| Vitest 4 | v18+ | ESM-native | Built-in |
| tsdown 0.20 | **v20.19+** | ESM-only | N/A (build tool) |
| chalk 5 | v12.17+ | ESM-only | Built-in |

**Effective minimum Node.js:** v20.19 (set by chokidar v5 and tsdown)

---

## Alternatives Considered (Summary)

| Category | Recommended | Passed Over | Why Not |
|----------|-------------|-------------|---------|
| CLI Framework | Commander.js 14 | oclif, yargs, Clipanion, Ink | Heavyweight, less TypeScript-friendly, smaller ecosystem, wrong paradigm |
| Template Engine | Eta 4 | Handlebars 4.7, EJS 4, Nunjucks | Unmaintained, HTML-escaping wrong for markdown, scalability issues, heavy |
| File Watching | Chokidar 5 | raw fs.watch, node-watch | Cross-platform bugs, missing features |
| Glob/Ignore | globby 16 | fast-glob (raw), node-glob | Missing .gitignore support (fast-glob), slower (node-glob) |
| Clustering | In-house DBSCAN + ml-kmeans | density-clustering, TensorFlow.js | 10-year-old unmaintained package, massive overkill |
| AST Parsing | ts-morph 27 | tree-sitter, babel-parser, swc, OXC | Native bindings, no TS support, wrong tool, overkill |
| Testing | Vitest 4 | Jest 30, node:test | ESM second-class in Jest, missing features in node:test |
| Build | tsdown 0.20 | tsup 8.5, unbuild 3.6, raw esbuild | tsup unmaintained, unbuild Nuxt-specific, esbuild needs manual config |
| Binary | bun compile | vercel/pkg, Node SEA | pkg aging, Node SEA not in LTS yet |

---

## Sources

- [Commander.js npm](https://www.npmjs.com/package/commander) -- v14.0.3, 116K dependents
- [Commander.js releases](https://github.com/tj/commander.js/releases) -- v15 planned May 2026
- [Eta npm](https://www.npmjs.com/package/eta) -- v4.5.1, 0 dependencies, TypeScript-native
- [Eta website](https://eta.js.org/) -- official docs
- [Chokidar npm](https://www.npmjs.com/package/chokidar) -- v5.0.0, ESM-only, Node v20.19+
- [Chokidar GitHub](https://github.com/paulmillr/chokidar) -- v5 release details
- [globby npm](https://www.npmjs.com/package/globby) -- v16.1.1, 62M weekly downloads
- [globby GitHub](https://github.com/sindresorhus/globby) -- .gitignore support docs
- [ml-kmeans npm](https://www.npmjs.com/package/ml-kmeans) -- v7.0.0, Zakodium/mljs maintained
- [ml-kmeans GitHub](https://github.com/mljs/kmeans)
- [density-clustering npm](https://www.npmjs.com/package/density-clustering) -- v1.3.0, last published 10 years ago
- [ts-morph npm](https://www.npmjs.com/package/ts-morph) -- v27.0.2, 2.8M weekly downloads
- [Vitest npm](https://www.npmjs.com/package/vitest) -- v4.0.18, 31M weekly downloads
- [Vitest 4.0 announcement](https://vitest.dev/blog/vitest-4) -- Jan 2026
- [Vitest vs Jest comparison](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [Vitest vs Jest 2026 benchmarks](https://www.sitepoint.com/vitest-vs-jest-2026-migration-benchmark/)
- [tsdown npm](https://www.npmjs.com/package/tsdown) -- v0.20.3, successor to tsup
- [tsdown website](https://tsdown.dev/) -- official docs
- [tsdown migration from tsup](https://tsdown.dev/guide/migrate-from-tsup)
- [tsup npm](https://www.npmjs.com/package/tsup) -- v8.5.1, officially unmaintained, recommends tsdown
- [Bun compile case study (Tigris)](https://www.tigrisdata.com/blog/using-bun-and-benchmark/) -- standalone binary with bun
- [Node.js SEA blog post](https://joyeecheung.github.io/blog/2026/01/26/improving-single-executable-application-building-for-node-js/) -- --build-sea in v25.5
- [Node.js SEA docs](https://nodejs.org/api/single-executable-applications.html)
- [Handlebars npm](https://www.npmjs.com/package/handlebars) -- v4.7.8, last published 3+ years ago
- [npm-compare: template engines](https://npm-compare.com/ejs,eta,handlebars,mustache,nunjucks,pug)
- [Jest vs Vitest 2025](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9)
- [Switching from tsup to tsdown](https://alan.norbauer.com/articles/tsdown-bundler/)
