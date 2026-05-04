import {
  type ConventionEntry,
  type ConventionRegistry,
  ConventionRegistrySchema,
} from "./schema.js";

/**
 * Create a new empty ConventionRegistry for the given project path.
 * The returned registry passes ConventionRegistrySchema validation.
 */
export function createRegistry(projectPath: string): ConventionRegistry {
  const registry: ConventionRegistry = {
    version: "1",
    projectPath,
    generatedAt: new Date().toISOString(),
    stack: {
      language: "unknown",
    },
    conventions: [],
    architecture: {
      layers: [],
    },
  };

  const result = ConventionRegistrySchema.safeParse(registry);
  if (!result.success) {
    throw new Error(
      `createRegistry produced invalid registry: ${JSON.stringify(result.error.issues)}`
    );
  }

  return result.data;
}

/**
 * Add a convention entry to the registry, auto-generating a UUID for the id.
 * Returns a new registry (does not mutate the input).
 */
export function addConvention(
  registry: ConventionRegistry,
  entry: Omit<ConventionEntry, "id">
): ConventionRegistry {
  const newEntry: ConventionEntry = {
    id: crypto.randomUUID(),
    ...entry,
  };

  const updated: ConventionRegistry = {
    ...registry,
    conventions: [...registry.conventions, newEntry],
  };

  const result = ConventionRegistrySchema.safeParse(updated);
  if (!result.success) {
    throw new Error(
      `addConvention produced invalid registry: ${JSON.stringify(result.error.issues)}`
    );
  }

  return result.data;
}
