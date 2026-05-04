import { createBridge } from "../../core/ez-search-bridge.js";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;

type ErrorStyle = "try-catch" | "result-type" | "custom-error-class" | "error-boundary";

interface PatternDef {
  style: ErrorStyle;
  pattern: string;
  test: (content: string) => boolean;
}

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

const PATTERNS: PatternDef[] = [
  {
    style: "try-catch",
    pattern: "try/catch imperative error handling",
    test: (content) => /\btry\s*\{/.test(content) && /\bcatch\s*\(/.test(content),
  },
  {
    style: "result-type",
    pattern: "Result/Either functional error handling",
    test: (content) =>
      /\bResult<|\bOk\(|\bErr\(|\bisOk\b|\bisErr\b|\bneverthrow\b/.test(content),
  },
  {
    style: "custom-error-class",
    pattern: "custom error class hierarchy",
    test: (content) => /class\s+\w+Error\b|\bnew\s+\w+Error\(/.test(content),
  },
  {
    style: "error-boundary",
    pattern: "React error boundary components",
    test: (content) => /\bErrorBoundary\b|\bcomponentDidCatch\b/.test(content),
  },
];

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const errorHandlingExtractor: Extractor = {
  name: "error-handling",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const bridge = await createBridge(ctx.projectPath);

    if (!(await bridge.hasIndex(ctx.projectPath))) {
      return [];
    }

    // Issue targeted search queries
    const [general, resultType, customErrors] = await Promise.all([
      bridge.search("error handling try catch throw exception", { k: 30 }),
      bridge.search("Result Ok Err return error value", { k: 20 }),
      bridge.search("custom error class extends Error", { k: 20 }),
    ]);

    // Merge and deduplicate chunks by file (concatenate text for same file)
    const fileContentMap = new Map<string, string>();
    for (const result of [...general, ...resultType, ...customErrors]) {
      const existing = fileContentMap.get(result.file) ?? "";
      fileContentMap.set(result.file, existing + "\n" + result.chunk);
    }

    const totalUniqueFiles = fileContentMap.size;
    if (totalUniqueFiles === 0) return [];

    const entries: Entry[] = [];

    for (const patternDef of PATTERNS) {
      const matchingFiles: string[] = [];

      for (const [file, content] of fileContentMap) {
        if (patternDef.test(content)) {
          matchingFiles.push(file);
        }
      }

      // Require at least 2 distinct files
      if (matchingFiles.length < 2) continue;

      const confidence = Math.min(0.95, 0.5 + (matchingFiles.length / totalUniqueFiles) * 0.45);

      entries.push({
        category: "error_handling",
        pattern: patternDef.pattern,
        confidence,
        evidence: matchingFiles.slice(0, 5).map((file) => ({ file, line: null })),
        metadata: {
          style: patternDef.style,
          fileCount: matchingFiles.length,
        },
      });
    }

    return entries;
  },
};
