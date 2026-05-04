import type { ConventionEntry } from "../core/schema.js";

// ---------------------------------------------------------------------------
// Extractor configuration
// ---------------------------------------------------------------------------

export interface ExtractorOptions {
  /** Maximum number of files to analyse with the AST. Default: 200. */
  maxFilesForAst?: number;
}

// ---------------------------------------------------------------------------
// Extraction context (passed to every extractor)
// ---------------------------------------------------------------------------

export interface ExtractionContext {
  /** Absolute or relative path to the project root. */
  projectPath: string;
  options?: ExtractorOptions;
}

// ---------------------------------------------------------------------------
// Extractor interface
// ---------------------------------------------------------------------------

/**
 * An Extractor reads project artefacts and returns zero or more convention
 * entries. IDs are intentionally omitted -- the registry runner assigns UUIDs
 * via `addConvention`.
 */
export interface Extractor {
  /** Human-readable name used in log messages. */
  name: string;
  extract(ctx: ExtractionContext): Promise<Omit<ConventionEntry, "id">[]>;
}
