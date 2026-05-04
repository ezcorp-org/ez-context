import { addConvention } from "../core/registry.js";
import type { ConventionRegistry } from "../core/schema.js";
import type { Extractor, ExtractionContext } from "./types.js";

/**
 * Run all extractors in parallel via Promise.allSettled so that a single
 * failing extractor does not abort the others.
 *
 * Fulfilled entries are added to the registry immutably via `addConvention`.
 * Rejected extractors emit a console.warn and are skipped.
 */
export async function runExtractors(
  extractors: Extractor[],
  ctx: ExtractionContext,
  registry: ConventionRegistry
): Promise<ConventionRegistry> {
  const results = await Promise.allSettled(
    extractors.map((e) => e.extract(ctx).then((entries) => ({ extractor: e, entries })))
  );

  let current = registry;

  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      for (const entry of result.value.entries) {
        current = addConvention(current, entry);
      }
    } else {
      console.warn(
        `[runExtractors] Extractor "${extractors[i]!.name}" failed:`,
        result.reason
      );
    }
  }

  return current;
}
