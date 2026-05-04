import yaml from "js-yaml";
import type { ConventionRegistry } from "../core/schema.js";
import { renderConventionsBody } from "./render-helpers.js";

/**
 * Render a Cursor MDC rule file (.cursor/rules/ez-context.mdc).
 *
 * Format: YAML frontmatter + markdown body.
 * - description: shown in Cursor UI
 * - globs: empty string (not null/omitted) per Cursor docs
 * - alwaysApply: true ensures conventions are always in context
 */
export function renderCursorMdc(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const frontmatter = yaml
    .dump({
      description: "Project conventions extracted by ez-context",
      globs: "",
      alwaysApply: true,
    })
    .trimEnd();

  const bodyLines = renderConventionsBody(registry, confidenceThreshold);
  // Remove trailing empty line added by renderConventionsBody
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
    bodyLines.pop();
  }
  const body = bodyLines.join("\n");

  return `---\n${frontmatter}\n---\n\n${body}\n`;
}
