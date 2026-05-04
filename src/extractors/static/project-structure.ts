import { globby } from "globby";
import { ALWAYS_SKIP } from "../../utils/fs.js";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;

interface TestPattern {
  glob: string;
  location: string;
  style: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Top-level test directory prefixes — files here are directory-based, not co-located. */
const TEST_DIR_PREFIXES = ["test/", "tests/", "__tests__/"];

const TEST_PATTERNS: TestPattern[] = [
  { glob: "**/*.test.{ts,tsx,js,jsx}", location: "co-located", style: "*.test.ts style" },
  { glob: "**/*.spec.{ts,tsx,js,jsx}", location: "co-located", style: "*.spec.ts style" },
  { glob: "test/**/*.{ts,tsx,js,jsx}", location: "test/ directory", style: "test/ directory" },
  { glob: "tests/**/*.{ts,tsx,js,jsx}", location: "tests/ directory", style: "tests/ directory" },
  { glob: "__tests__/**/*.{ts,tsx,js,jsx}", location: "__tests__/ directory", style: "__tests__/ directory" },
];

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const projectStructureExtractor: Extractor = {
  name: "project-structure",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const entries: Entry[] = [];

    for (const { glob, location, style } of TEST_PATTERNS) {
      let matches = await globby(glob, {
        cwd: ctx.projectPath,
        gitignore: true,
        ignore: [...ALWAYS_SKIP],
        followSymbolicLinks: false,
        absolute: false,
      });

      // For co-located patterns, exclude files that live in dedicated test directories
      if (location === "co-located") {
        matches = matches.filter(
          (f) => !TEST_DIR_PREFIXES.some((prefix) => f.startsWith(prefix))
        );
      }

      if (matches.length === 0) continue;

      const count = matches.length;
      const confidence = Math.min(0.95, 0.5 + count * 0.05);
      const evidenceFiles = matches.slice(0, 5);

      entries.push({
        category: "testing",
        pattern: `Test files in ${location} (${style})`,
        confidence,
        evidence: evidenceFiles.map((f) => ({ file: f, line: null })),
        metadata: {
          testFileCount: count,
          location,
          style,
        },
      });
    }

    return entries;
  },
};
