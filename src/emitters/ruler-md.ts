import type { ConventionRegistry } from "../core/schema.js";
import { renderConventionsBody } from "./render-helpers.js";

/**
 * Render a Ruler rule file (.ruler/ez-context.md).
 *
 * Format: Plain markdown, no YAML frontmatter.
 * Ruler recursively discovers all .md files in .ruler/ and distributes them.
 * ez-context writes a single .ruler/ez-context.md as an additive conventions file.
 */
export function renderRulerMd(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const lines: string[] = [];

  lines.push("# Project Conventions (ez-context)");
  lines.push("");

  const bodyLines = renderConventionsBody(registry, confidenceThreshold);
  // Remove trailing empty line
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
    bodyLines.pop();
  }
  lines.push(...bodyLines);

  return lines.join("\n") + "\n";
}
