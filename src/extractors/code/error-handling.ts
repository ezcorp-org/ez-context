import { Project, SyntaxKind } from "ts-morph";
import { listProjectFiles } from "../../utils/fs.js";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const staticErrorHandlingExtractor: Extractor = {
  name: "static-error-handling",

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

    let tryCatchFileCount = 0;
    let tryCatchTotalCount = 0;
    let customErrorClassCount = 0;
    const tryCatchEvidence: string[] = [];
    const customErrorEvidence: string[] = [];

    for (const sf of project.getSourceFiles()) {
      const relPath = sf.getFilePath().replace(ctx.projectPath + "/", "");

      const tryStatements = sf.getDescendantsOfKind(SyntaxKind.TryStatement);
      if (tryStatements.length > 0) {
        tryCatchFileCount++;
        tryCatchTotalCount += tryStatements.length;
        if (tryCatchEvidence.length < 5) tryCatchEvidence.push(relPath);
      }

      for (const cls of sf.getClasses()) {
        const heritage = cls.getExtends();
        if (heritage && /\bError\b/.test(heritage.getText())) {
          customErrorClassCount++;
          if (customErrorEvidence.length < 5) customErrorEvidence.push(relPath);
        }
      }
    }

    const entries: Entry[] = [];
    const totalFiles = filesToAnalyse.length;

    // Require at least 2 try/catch occurrences (across 1+ files) for a meaningful pattern
    if (tryCatchTotalCount >= 2) {
      // Confidence based on both file spread and occurrence density
      const fileSpread = tryCatchFileCount / totalFiles;
      const densityBoost = Math.min(0.2, tryCatchTotalCount * 0.05);
      const confidence = Math.min(0.95, 0.5 + fileSpread * 0.35 + densityBoost);
      entries.push({
        category: "error_handling",
        pattern: "try/catch imperative error handling",
        confidence,
        evidence: tryCatchEvidence.map((file) => ({ file, line: null })),
        metadata: { style: "try-catch", fileCount: tryCatchFileCount, totalCount: tryCatchTotalCount },
      });
    }

    if (customErrorClassCount >= 1) {
      const confidence = Math.min(0.95, 0.5 + (customErrorClassCount / totalFiles) * 0.45);
      entries.push({
        category: "error_handling",
        pattern: "custom error class hierarchy",
        confidence,
        evidence: customErrorEvidence.map((file) => ({ file, line: null })),
        metadata: { style: "custom-error-class", classCount: customErrorClassCount },
      });
    }

    return entries;
  },
};
