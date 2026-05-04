import yaml from "js-yaml";
import type { ConventionRegistry } from "../core/schema.js";
import { renderConventionsBody } from "./render-helpers.js";

/**
 * Render a SKILL.md module file (.skills/ez-context/SKILL.md).
 *
 * Format: YAML frontmatter + markdown body.
 * - name: must match directory name (ez-context)
 * - description: max 1024 chars, describes what AND when to use
 * Body stays under 5000 tokens (~3750 words) as per SKILL.md spec.
 */
export function renderSkillMd(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const description =
    "Project conventions and coding standards for this codebase. " +
    "Use when writing new code, reviewing patterns, or understanding project architecture.";

  const frontmatter = yaml
    .dump({
      name: "ez-context",
      description,
    })
    .trimEnd();

  const bodyLines = renderConventionsBody(registry, confidenceThreshold);
  // Remove trailing empty line
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === "") {
    bodyLines.pop();
  }
  const body = bodyLines.join("\n");

  return `---\n${frontmatter}\n---\n\n${body}\n`;
}
