import { join, dirname, resolve } from "node:path";
import { Project } from "ts-morph";
import { listProjectFiles } from "../../utils/fs.js";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;
type SourceFile = ReturnType<InstanceType<typeof Project>["getSourceFiles"]>[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Known path alias prefixes used across JS/TS ecosystems. */
const ALIAS_PREFIXES = ["@/", "~/", "#/", "$lib/"];

function hasPathAlias(specifier: string): boolean {
  return ALIAS_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

/**
 * Check whether a source file looks like a barrel file:
 * - Has at least one export declaration
 * - Has no function, class, or variable declarations
 */
function isBarrelFile(sourceFile: SourceFile): boolean {
  const hasExports = sourceFile.getExportDeclarations().length > 0;
  if (!hasExports) return false;
  const hasFunctions = sourceFile.getFunctions().length > 0;
  const hasClasses = sourceFile.getClasses().length > 0;
  const hasVars = sourceFile.getVariableDeclarations().length > 0;
  return !hasFunctions && !hasClasses && !hasVars;
}

/**
 * Build a set of absolute paths for barrel files (index.ts/js variants).
 * Since skipFileDependencyResolution prevents module resolution,
 * we identify barrel files upfront and match imports by path.
 */
function buildBarrelFileSet(project: Project): Set<string> {
  const barrels = new Set<string>();
  for (const sf of project.getSourceFiles()) {
    const filePath = sf.getFilePath();
    const baseName = filePath.split("/").pop() ?? "";
    // Only index files can be barrel files (index.ts, index.tsx, index.js, index.jsx)
    if (/^index\.[tj]sx?$/.test(baseName) && isBarrelFile(sf)) {
      barrels.add(filePath);
    }
  }
  return barrels;
}

/** Resolve a relative import specifier to candidate absolute paths. */
function resolveRelativeImport(importingFile: string, specifier: string): string[] {
  const dir = dirname(importingFile);
  const base = resolve(dir, specifier);
  const exts = [".ts", ".tsx", ".js", ".jsx"];
  const candidates: string[] = [];
  // Direct file: ./foo -> ./foo.ts etc
  for (const ext of exts) candidates.push(base + ext);
  // Directory index: ./foo -> ./foo/index.ts etc
  for (const ext of exts) candidates.push(join(base, "index" + ext));
  return candidates;
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const importsExtractor: Extractor = {
  name: "imports",

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

    const absPaths = filesToAnalyse.map((f) => `${ctx.projectPath}/${f}`);
    project.addSourceFilesAtPaths(absPaths);

    // Pre-compute barrel file set for path-based matching
    const barrelFiles = buildBarrelFileSet(project);

    let relativeCount = 0;
    let externalCount = 0;
    let barrelCount = 0;
    let aliasCount = 0;

    for (const sf of project.getSourceFiles()) {
      for (const imp of sf.getImportDeclarations()) {
        const specifier = imp.getModuleSpecifierValue();

        if (imp.isModuleSpecifierRelative()) {
          relativeCount++;

          // Barrel detection via path heuristic
          const candidates = resolveRelativeImport(sf.getFilePath(), specifier);
          if (candidates.some((c) => barrelFiles.has(c))) {
            barrelCount++;
          }
        } else {
          externalCount++;

          if (hasPathAlias(specifier)) {
            aliasCount++;
          }
        }
      }
    }

    const totalImports = relativeCount + externalCount;
    if (totalImports === 0) return [];

    const entries: Entry[] = [];
    const evidence = [{ file: "src/**/*.ts", line: null }];

    // --- Import organization pattern ---
    const relRatio = relativeCount / totalImports;
    let orgPattern: string;
    if (relRatio >= 0.75) {
      orgPattern = "Predominantly relative imports";
    } else if (relRatio <= 0.25) {
      orgPattern = "Predominantly external imports";
    } else {
      orgPattern = "Mix of relative and external imports";
    }

    // Confidence scales with sample size (saturates at 100 imports)
    const sizeConfidence = Math.min(0.95, 0.5 + (totalImports / 100) * 0.45);

    entries.push({
      category: "imports",
      pattern: orgPattern,
      confidence: sizeConfidence,
      evidence,
      metadata: {
        relativeCount,
        externalCount,
        totalImports,
        relativeRatio: Math.round(relRatio * 100) / 100,
      },
    });

    // --- Barrel file usage ---
    if (barrelCount > 0) {
      const barrelRatio = barrelCount / relativeCount;
      entries.push({
        category: "imports",
        pattern: "Uses barrel file (index) imports",
        confidence: Math.min(0.95, 0.5 + barrelRatio * 0.45),
        evidence,
        metadata: { barrelCount, relativeCount },
      });
    }

    // --- Path alias usage ---
    if (aliasCount > 0) {
      entries.push({
        category: "imports",
        pattern: "Uses path aliases (@/ prefix)",
        confidence: 1.0,
        evidence,
        metadata: { aliasCount },
      });
    }

    return entries;
  },
};
