import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

export const MARKER_START = "<!-- ez-context:start -->";
export const MARKER_END = "<!-- ez-context:end -->";

/**
 * Write content into the marker section of filePath.
 *
 * Three paths:
 * 1. File does not exist: creates it with markers wrapping content.
 * 2. File exists, no markers (or only one marker): appends the section at the end.
 * 3. File exists with both markers: splices new content between existing markers,
 *    preserving everything outside.
 */
export async function writeWithMarkers(
  filePath: string,
  content: string
): Promise<void> {
  const wrapped = `${MARKER_START}\n${content}\n${MARKER_END}`;

  if (!existsSync(filePath)) {
    await writeFile(filePath, wrapped + "\n", "utf-8");
    return;
  }

  const existing = await readFile(filePath, "utf-8");
  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);

  // Treat missing or unpaired marker as "no markers" — append section
  if (startIdx === -1 || endIdx === -1) {
    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    await writeFile(filePath, existing + separator + wrapped + "\n", "utf-8");
    return;
  }

  const before = existing.slice(0, startIdx);
  const after = existing.slice(endIdx + MARKER_END.length);
  await writeFile(filePath, before + wrapped + after, "utf-8");
}
