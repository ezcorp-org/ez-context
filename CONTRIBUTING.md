# Contributing to ez-context

Contributions are welcome. This guide covers the development workflow and conventions for the project.

## Development Setup

```bash
git clone https://github.com/ezcorp-org/ez-context.git
cd ez-context
npm install
```

Key scripts:

| Command | Purpose |
|---------|---------|
| `npm test` | Run tests (single run) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run build` | Production build |
| `npm run dev` | Development mode |

## How to Add a New Extractor

1. Create a file in the appropriate directory under `src/extractors/`:
   - `static/` -- pattern-based extraction from file structure
   - `code/` -- AST or content-based extraction from source files
   - `semantic/` -- higher-level inference from multiple signals

2. Implement the `Extractor` interface, which requires a `name` property and an `extract` method that returns `ConventionEntry[]` (without the `id` field).

3. Register the extractor in the `ALL_EXTRACTORS` array in `src/core/pipeline.ts`.

4. Each `ConventionEntry` must include `category`, `pattern`, `confidence`, and `evidence`. Use the `metadata` field to populate `StackInfo` when applicable.

5. Extractors run in parallel via `Promise.allSettled` and must be stateless -- no shared mutable state between extractors.

## How to Add a New Output Format

1. Create a renderer in `src/emitters/` that exports a function with the signature `(registry, threshold) => string`.

2. Add the format name to the `OutputFormat` union type in `src/emitters/types.ts`.

3. Register the format in `FORMAT_EMITTER_MAP` in `src/emitters/index.ts`, specifying the `filename` and `write` strategy (`"markers"` or `"direct"`).

4. Add the format to `VALID_FORMATS` in `src/commands/generate.ts`.

## Code Style

- ESLint strict TypeScript configuration. No use of `any`. Use consistent type imports (`import type`).
- ESM imports only. The project uses `"type": "module"`.
- Types are inferred from Zod schemas. Do not create duplicate interface definitions for types that Zod already provides.

## Testing

- Test framework: Vitest.
- Test files live in `test/`, mirroring the `src/` directory structure.
- Run `npm test` for a single run or `npm run test:watch` during development.
- New features and extractors should include corresponding tests.

## Pull Request Process

1. Open an issue first for significant changes to discuss the approach.
2. Fork the repository and create a feature branch.
3. Make your changes, keeping the PR focused on a single concern.
4. Before submitting, verify:
   - `npm test` passes
   - `npm run lint` is clean
   - `npm run typecheck` succeeds
5. Submit a pull request with a clear description of the change and its motivation.
