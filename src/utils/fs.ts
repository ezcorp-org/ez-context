import { globby } from "globby";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Directories and paths that are always excluded from file listings. */
export const ALWAYS_SKIP: readonly string[] = [
  "**/node_modules/**",
  "**/dist/**",
  "**/generated/**",
  "**/.ez-search/**",
  "**/.ez-context/**",
  "**/.git/**",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ListFilesOptions {
  /** The project root to search from. */
  cwd: string;
  /** File extensions to include (without dot). Defaults to ts, js, json, md. */
  extensions?: string[];
  /** Additional ignore patterns (glob syntax). */
  additionalIgnore?: string[];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * List project files while respecting .gitignore (INTG-04) and always
 * skipping common generated/build directories.
 *
 * @returns Relative paths sorted alphabetically.
 */
export async function listProjectFiles(
  options: ListFilesOptions
): Promise<string[]> {
  const {
    cwd,
    extensions = ["ts", "js", "json", "md"],
    additionalIgnore = [],
  } = options;

  const extPattern =
    extensions.length === 1
      ? `**/*.${extensions[0]}`
      : `**/*.{${extensions.join(",")}}`;

  const files = await globby(extPattern, {
    cwd,
    gitignore: true,
    ignore: [...ALWAYS_SKIP, ...additionalIgnore],
    followSymbolicLinks: false,
    absolute: false,
  });

  return files.sort();
}
