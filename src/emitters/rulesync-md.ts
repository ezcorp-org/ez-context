import yaml from "js-yaml";
import type { ConventionRegistry } from "../core/schema.js";
import { renderConventionsBody } from "./render-helpers.js";

/**
 * Render a Rulesync rule file (.rulesync/rules/ez-context.md).
 *
 * Format: YAML frontmatter + markdown body.
 * - targets: specifies which AI tools receive this rule
 * ez-context writes INTO .rulesync/rules/; Rulesync distributes to tools.
 */
export function renderRulesyncMd(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const frontmatter = yaml
    .dump({
      description: "Project conventions extracted by ez-context",
      targets: ["cursor", "copilot", "windsurf"],
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
