import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CompilerOptions = {
  strict?: boolean;
  target?: string;
  module?: string;
  moduleResolution?: string;
  paths?: Record<string, string[]>;
  [key: string]: unknown;
};

type TsConfig = {
  compilerOptions?: CompilerOptions;
  [key: string]: unknown;
};

type Entry = Omit<ConventionEntry, "id">;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVIDENCE = [{ file: "tsconfig.json", line: null }];

/**
 * Strip single-line // comments and trailing commas so JSON.parse accepts
 * tsconfig.json files that use non-standard JSON.
 */
function stripTsConfigNonStandardJson(raw: string): string {
  return raw
    // Remove single-line comments (// ...)
    .replace(/\/\/[^\n]*/g, "")
    // Remove trailing commas before ] or }
    .replace(/,(\s*[}\]])/g, "$1");
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const tsconfigExtractor: Extractor = {
  name: "tsconfig",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const filePath = join(ctx.projectPath, "tsconfig.json");

    try {
      await access(filePath);
    } catch {
      return [];
    }

    let config: TsConfig;
    try {
      const raw = await readFile(filePath, "utf-8");
      config = JSON.parse(stripTsConfigNonStandardJson(raw)) as TsConfig;
    } catch {
      return [];
    }

    const co = config.compilerOptions ?? {};
    const entries: Entry[] = [];

    // --- Strict mode ---
    if (co.strict === true) {
      entries.push({
        category: "stack",
        pattern: "TypeScript strict mode enabled",
        confidence: 1.0,
        evidence: EVIDENCE,
        metadata: { strict: true },
      });
    }

    // --- Notable compiler options ---
    const notable: Record<string, unknown> = {};
    for (const key of ["target", "module", "moduleResolution"] as const) {
      if (co[key] !== undefined) {
        notable[key] = co[key];
      }
    }
    if (Object.keys(notable).length > 0) {
      entries.push({
        category: "stack",
        pattern: "TypeScript compiler options configured",
        confidence: 1.0,
        evidence: EVIDENCE,
        metadata: notable,
      });
    }

    // --- Path aliases ---
    if (co.paths && Object.keys(co.paths).length > 0) {
      entries.push({
        category: "imports",
        pattern: "Uses TypeScript path aliases",
        confidence: 1.0,
        evidence: EVIDENCE,
        metadata: { aliases: co.paths },
      });
    }

    return entries;
  },
};
