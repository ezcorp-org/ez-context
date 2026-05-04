// Emitter types for ez-context output generation

export type OutputFormat =
  | "claude"
  | "agents"
  | "cursor"
  | "copilot"
  | "skills"
  | "rulesync"
  | "ruler";

export interface EmitOptions {
  /** Directory where output files will be written */
  outputDir: string;
  /** Minimum confidence threshold for including conventions (default: 0.7) */
  confidenceThreshold?: number;
  /** Return rendered content without writing files to disk */
  dryRun?: boolean;
  /** Output formats to generate (default: ["claude", "agents"]) */
  formats?: OutputFormat[];
}

export interface EmitResult {
  /** Rendered content map keyed by format name */
  rendered: Record<string, string>;
  /** Absolute paths of files written (empty if dryRun) */
  filesWritten: string[];
  /** Rendered CLAUDE.md content (backward compat alias) */
  claudeMd: string;
  /** Rendered AGENTS.md content (backward compat alias) */
  agentsMd: string;
}
