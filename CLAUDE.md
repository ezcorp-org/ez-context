<!-- ez-context:start -->
# Project Context

## Stack
- Language: TypeScript
- Build: tsdown
- Package Manager: bun
- Test Runner: Vitest

## Conventions
- **imports**: ES modules (package.json "type": "module")
- **imports**: Mix of relative and external imports
- **stack**: TypeScript strict mode enabled
- **stack**: TypeScript compiler options configured
- **stack**: CI command: bun run lint
- **stack**: CI command: bun run build
- **testing**: CI command: bun run test
- **testing**: Test files in co-located (*.test.ts style)
- **testing**: Test files in test/ directory (test/ directory)
- **naming**: functions use camelCase naming
- **naming**: classes use PascalCase naming
- **error_handling**: try/catch imperative error handling

<!-- ez-context:end -->
