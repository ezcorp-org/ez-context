import { createBridge } from "../../core/ez-search-bridge.js";
import { listProjectFiles } from "../../utils/fs.js";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;

type ArchPattern = "MVC" | "feature-based" | "layer-based";

// ---------------------------------------------------------------------------
// Directory pattern detection
// ---------------------------------------------------------------------------

/** Get directory paths under src/ (or project root if no src/). */
function extractSourceDirs(files: string[]): Set<string> {
  const dirs = new Set<string>();
  for (const f of files) {
    const parts = f.split("/");
    if (parts.length < 2) continue;

    if (parts[0] === "src" && parts.length >= 3) {
      // Under src/ -- use "src/subdir" as the dir
      dirs.add(`src/${parts[1]}`);
    } else if (parts[0] !== "src") {
      // Project root level
      dirs.add(parts[0]!);
    }
  }
  return dirs;
}

/** Normalise a directory name to lower case for matching. */
function normalise(dir: string): string {
  return dir.split("/").pop()!.toLowerCase();
}

/** Detect MVC: >= 2 of models/, views/, controllers/, routes/ */
function detectMVC(sourceDirs: Set<string>): string[] {
  const mvc = ["model", "models", "view", "views", "controller", "controllers", "route", "routes"];
  const found: string[] = [];
  for (const dir of sourceDirs) {
    if (mvc.includes(normalise(dir))) found.push(dir);
  }
  // Deduplicate by canonical name (model/models both count as one)
  const canonical = new Set(found.map((d) => normalise(d).replace(/s$/, "")));
  return canonical.size >= 2 ? found : [];
}

/** Detect feature-based: files under features/, modules/, pages/ with >= 5 files total. */
function detectFeatureBased(files: string[]): string[] {
  const featurePattern = /\/(features?|modules?|pages?)\//i;
  const featureDirs = new Set<string>();
  let count = 0;
  for (const f of files) {
    if (featurePattern.test(f)) {
      count++;
      // Extract the feature root dir (e.g. "src/features" or "features")
      const match = f.match(/^(.*?\/(features?|modules?|pages?))\//i);
      if (match) featureDirs.add(match[1]!);
    }
  }
  return count >= 5 ? Array.from(featureDirs) : [];
}

/** Detect layer-based architecture (DDD / hexagonal / clean arch). */
function detectLayerBased(sourceDirs: Set<string>): string[] {
  const layerPatterns = [
    // DDD
    "domain", "application", "infrastructure",
    // Hexagonal
    "service", "services", "repository", "repositories", "handler", "handlers", "usecase", "usecases",
    // Clean arch
    "core", "data", "presentation",
  ];
  const found: string[] = [];
  for (const dir of sourceDirs) {
    if (layerPatterns.includes(normalise(dir))) found.push(dir);
  }
  // Need >= 2 distinct layer dirs
  const canonical = new Set(found.map((d) => normalise(d)));
  return canonical.size >= 2 ? found : [];
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const architectureExtractor: Extractor = {
  name: "architecture",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    // Signal 1: Directory structure scan (deterministic)
    const files = await listProjectFiles({
      cwd: ctx.projectPath,
      extensions: ["ts", "js", "tsx", "jsx", "py", "rb", "go", "rs"],
    });

    const sourceDirs = extractSourceDirs(files);

    // Try each pattern
    const mvcDirs = detectMVC(sourceDirs);
    const featureDirs = detectFeatureBased(files);
    const layerDirs = detectLayerBased(sourceDirs);

    let detectedPattern: ArchPattern | null = null;
    let detectedLayers: string[] = [];

    if (mvcDirs.length > 0) {
      detectedPattern = "MVC";
      detectedLayers = mvcDirs;
    } else if (featureDirs.length > 0) {
      detectedPattern = "feature-based";
      detectedLayers = featureDirs;
    } else if (layerDirs.length > 0) {
      detectedPattern = "layer-based";
      detectedLayers = layerDirs;
    }

    if (!detectedPattern) return [];

    // Signal 2: Semantic search confirmation (optional -- adds evidence and boosts confidence)
    const bridge = await createBridge(ctx.projectPath);
    const hasIdx = await bridge.hasIndex(ctx.projectPath);

    let confidence = 0.7; // directory-only
    const evidence: { file: string; line: null }[] = detectedLayers
      .slice(0, 3)
      .map((dir) => ({ file: dir, line: null }));

    if (hasIdx) {
      const searchResults = await bridge.search(
        "model view controller route handler service repository",
        { k: 20 }
      );
      if (searchResults.length > 0) {
        confidence = 0.85;
        for (const r of searchResults.slice(0, 2)) {
          evidence.push({ file: r.file, line: null });
        }
      }
    }

    // Deduplicate evidence by file
    const seen = new Set<string>();
    const deduped = evidence.filter(({ file }) => {
      if (seen.has(file)) return false;
      seen.add(file);
      return true;
    });

    return [
      {
        category: "architecture",
        pattern: patternLabel(detectedPattern),
        confidence,
        evidence: deduped.slice(0, 5),
        metadata: {
          architecturePattern: detectedPattern,
          layers: detectedLayers,
        },
      },
    ];
  },
};

function patternLabel(p: ArchPattern): string {
  switch (p) {
    case "MVC":
      return "MVC architecture pattern";
    case "feature-based":
      return "Feature-based architecture";
    case "layer-based":
      return "Layer-based architecture";
  }
}

// ---------------------------------------------------------------------------
// Helpers exposed for testing
// ---------------------------------------------------------------------------

export { extractSourceDirs, detectMVC, detectFeatureBased, detectLayerBased };
