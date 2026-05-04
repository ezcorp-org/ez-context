import { Project } from "ts-morph";
import { listProjectFiles } from "../../utils/fs.js";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;
type CaseKind = "camelCase" | "PascalCase" | "snake_case" | "UPPER_SNAKE_CASE";

// ---------------------------------------------------------------------------
// Case classification
// ---------------------------------------------------------------------------

/**
 * Classify the naming convention of a single identifier.
 * Returns null for short names (< 4 chars) or unclassifiable names.
 */
function classifyCase(name: string): CaseKind | null {
  if (name.length < 4) return null;

  if (/^[A-Z][A-Z0-9_]{3,}$/.test(name)) return "UPPER_SNAKE_CASE";
  if (/^[A-Z][a-zA-Z0-9]+$/.test(name)) return "PascalCase";
  if (/^[a-z][a-z0-9_]+$/.test(name) && name.includes("_")) return "snake_case";
  if (/^[a-z][a-zA-Z0-9]+$/.test(name) && /[A-Z]/.test(name)) return "camelCase";

  return null;
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const namingExtractor: Extractor = {
  name: "naming",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const files = await listProjectFiles({
      cwd: ctx.projectPath,
      extensions: ["ts", "tsx", "js", "jsx"],
    });

    if (files.length === 0) return [];

    const maxFiles = ctx.options?.maxFilesForAst ?? 200;
    const filesToAnalyse = files.slice(0, maxFiles);

    const project = new Project({
      compilerOptions: { allowJs: true, noEmit: true },
      skipFileDependencyResolution: true,
    });

    // Absolute paths needed for ts-morph
    const absPaths = filesToAnalyse.map((f) => `${ctx.projectPath}/${f}`);
    project.addSourceFilesAtPaths(absPaths);

    // Track counts: { functions, variables, classes } -> { CaseKind -> count }
    const functions: Record<string, number> = {};
    const variables: Record<string, number> = {};
    const classes: Record<string, number> = {};
    const counts: Record<string, Record<string, number>> = { functions, variables, classes };

    for (const sf of project.getSourceFiles()) {
      for (const fn of sf.getFunctions()) {
        const name = fn.getName();
        if (!name) continue;
        const kind = classifyCase(name);
        if (kind) functions[kind] = (functions[kind] ?? 0) + 1;
      }

      for (const decl of sf.getVariableDeclarations()) {
        const name = decl.getName();
        const kind = classifyCase(name);
        if (kind) variables[kind] = (variables[kind] ?? 0) + 1;
      }

      for (const cls of sf.getClasses()) {
        const name = cls.getName();
        if (!name) continue;
        const kind = classifyCase(name);
        if (kind) classes[kind] = (classes[kind] ?? 0) + 1;
      }
    }

    const entries: Entry[] = [];

    for (const [entityType, caseCounts] of Object.entries(counts)) {
      const total = Object.values(caseCounts).reduce((a, b) => a + b, 0);
      if (total < 3) continue;

      // Find dominant case
      let dominant: CaseKind | null = null;
      let dominantCount = 0;
      for (const [kind, count] of Object.entries(caseCounts)) {
        if (count > dominantCount) {
          dominant = kind as CaseKind;
          dominantCount = count;
        }
      }

      if (!dominant) continue;

      const confidence = Math.min(0.95, dominantCount / total);
      if (confidence < 0.6) continue;

      entries.push({
        category: "naming",
        pattern: `${entityType} use ${dominant} naming`,
        confidence,
        evidence: [{ file: "src/**/*.ts", line: null }],
        metadata: {
          entityType,
          dominantCase: dominant,
          counts: caseCounts,
          sampleSize: total,
        },
      });
    }

    return entries;
  },
};
