import { access } from "node:fs/promises";
import { join } from "node:path";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Lockfile → package manager mapping (priority order)
// ---------------------------------------------------------------------------

const LOCKFILES: Array<{ file: string; manager: string }> = [
  { file: "bun.lock", manager: "bun" },
  { file: "bun.lockb", manager: "bun" },
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "package-lock.json", manager: "npm" },
];

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;

export const lockfileExtractor: Extractor = {
  name: "lockfile",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    for (const { file, manager } of LOCKFILES) {
      try {
        await access(join(ctx.projectPath, file));
        return [
          {
            category: "stack",
            pattern: `Package manager: ${manager}`,
            confidence: 1.0,
            evidence: [{ file, line: null }],
            metadata: { packageManager: manager },
          },
        ];
      } catch {
        // not found, try next
      }
    }

    return [];
  },
};
