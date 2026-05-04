import { createRegistry } from "./registry.js";
import { ConventionRegistrySchema } from "./schema.js";
import type { ConventionEntry, ConventionRegistry, EvidenceRef } from "./schema.js";
import { runExtractors } from "../extractors/index.js";
import type { ExtractorOptions } from "../extractors/types.js";
import { packageJsonExtractor } from "../extractors/static/package-json.js";
import { lockfileExtractor } from "../extractors/static/lockfile.js";
import { tsconfigExtractor } from "../extractors/static/tsconfig.js";
import { goModExtractor } from "../extractors/static/go-mod.js";
import { cargoTomlExtractor } from "../extractors/static/cargo-toml.js";
import { ciExtractor } from "../extractors/static/ci.js";
import { projectStructureExtractor } from "../extractors/static/project-structure.js";
import { namingExtractor } from "../extractors/code/naming.js";
import { importsExtractor } from "../extractors/code/imports.js";
import { staticErrorHandlingExtractor } from "../extractors/code/error-handling.js";
import { errorHandlingExtractor } from "../extractors/semantic/error-handling.js";
import { architectureExtractor } from "../extractors/semantic/architecture.js";

// ---------------------------------------------------------------------------
// Extractor registry (ordered by confidence priority for StackInfo population)
// ---------------------------------------------------------------------------

const ALL_EXTRACTORS = [
  packageJsonExtractor,
  lockfileExtractor,
  tsconfigExtractor,
  goModExtractor,
  cargoTomlExtractor,
  ciExtractor,
  projectStructureExtractor,
  namingExtractor,
  importsExtractor,
  staticErrorHandlingExtractor,
  errorHandlingExtractor,
  architectureExtractor,
];

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

/**
 * Deduplicate evidence by file+line combination.
 */
function deduplicateEvidence(evidence: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set<string>();
  return evidence.filter((e) => {
    const key = `${e.file}:${e.line ?? "null"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Deduplicate conventions by category+pattern.
 * For duplicates, keep the one with higher confidence.
 * Merge evidence arrays from duplicates.
 */
function deduplicateConventions(
  conventions: ConventionEntry[]
): ConventionEntry[] {
  const grouped = new Map<string, ConventionEntry>();

  for (const entry of conventions) {
    const key = `${entry.category}:${entry.pattern}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, entry);
    } else {
      // Keep higher confidence, merge evidence
      const winner: ConventionEntry =
        entry.confidence > existing.confidence ? entry : existing;
      const mergedEvidence = deduplicateEvidence([
        ...existing.evidence,
        ...entry.evidence,
      ]);
      grouped.set(key, { ...winner, evidence: mergedEvidence });
    }
  }

  return Array.from(grouped.values());
}

// ---------------------------------------------------------------------------
// StackInfo population helpers
// ---------------------------------------------------------------------------

/**
 * Populate StackInfo from extracted conventions via a post-extraction pass.
 * Conventions are processed in array order; first match wins for each field.
 */
function populateStackInfo(registry: ConventionRegistry): ConventionRegistry {
  const stack = { ...registry.stack };

  for (const entry of registry.conventions) {
    const meta = entry.metadata ?? {};

    if (entry.category === "stack") {
      if (!stack.language || stack.language === "unknown") {
        if (typeof meta.language === "string") {
          stack.language = meta.language;
        }
      }
      if (!stack.framework && typeof meta.framework === "string") {
        stack.framework = meta.framework;
      }
      if (!stack.testRunner && typeof meta.testRunner === "string") {
        stack.testRunner = meta.testRunner;
      }
      if (!stack.packageManager && typeof meta.packageManager === "string") {
        stack.packageManager = meta.packageManager;
      }
      if (!stack.buildTool) {
        // Detect buildTool from scripts metadata
        if (typeof meta.buildTool === "string") {
          stack.buildTool = meta.buildTool;
        } else if (
          typeof meta.scriptName === "string" &&
          meta.scriptName === "build" &&
          typeof meta.command === "string"
        ) {
          // Extract the build tool from the build script command (first word)
          stack.buildTool = (meta.command as string).split(" ")[0];
        }
      }
    }

    if (entry.category === "testing") {
      if (!stack.testRunner && typeof meta.testRunner === "string") {
        stack.testRunner = meta.testRunner;
      }
    }
  }

  return { ...registry, stack };
}

// ---------------------------------------------------------------------------
// ArchitectureInfo population helpers
// ---------------------------------------------------------------------------

/**
 * Populate ArchitectureInfo from extracted conventions via a post-extraction pass.
 * First architecture convention with the relevant metadata wins.
 */
function populateArchitectureInfo(
  registry: ConventionRegistry
): ConventionRegistry {
  const arch = { ...registry.architecture };

  for (const entry of registry.conventions) {
    if (entry.category === "architecture") {
      if (
        !arch.pattern &&
        typeof entry.metadata?.architecturePattern === "string"
      ) {
        arch.pattern = entry.metadata.architecturePattern;
      }
      if (
        arch.layers.length === 0 &&
        Array.isArray(entry.metadata?.layers)
      ) {
        arch.layers = entry.metadata.layers as string[];
      }
    }
  }

  return { ...registry, architecture: arch };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the full extraction pipeline against the given project path.
 *
 * 1. Runs all extractors in parallel (Promise.allSettled)
 * 2. Deduplicates conventions by category+pattern (higher confidence wins)
 * 3. Populates StackInfo from convention metadata
 * 4. Populates ArchitectureInfo from convention metadata
 * 5. Validates and returns the final ConventionRegistry
 */
export async function extractConventions(
  projectPath: string,
  options?: ExtractorOptions
): Promise<ConventionRegistry> {
  const ctx = { projectPath, options };
  const emptyRegistry = createRegistry(projectPath);

  // Run all extractors
  const populated = await runExtractors(ALL_EXTRACTORS, ctx, emptyRegistry);

  // Deduplicate conventions
  const deduplicated: ConventionRegistry = {
    ...populated,
    conventions: deduplicateConventions(populated.conventions),
  };

  // Populate StackInfo from convention metadata
  const withStack = populateStackInfo(deduplicated);

  // Populate ArchitectureInfo from convention metadata
  const withArch = populateArchitectureInfo(withStack);

  // Validate and return
  return ConventionRegistrySchema.parse(withArch);
}
