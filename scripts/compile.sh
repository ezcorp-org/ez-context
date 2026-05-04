#!/usr/bin/env bash
set -euo pipefail

echo "Building TypeScript..."
bun run build

echo "Compiling standalone binary..."
bun build src/cli.ts --compile --outfile dist/ez-context

echo "Binary size: $(du -h dist/ez-context | cut -f1)"
echo "Done: dist/ez-context"
