import type { ConventionRegistry, ConventionEntry } from "../core/schema.js";
import { extractCommands, isRedundantConvention } from "./render-helpers.js";

// ---------------------------------------------------------------------------
// Data prep
// ---------------------------------------------------------------------------

function prepData(registry: ConventionRegistry, confidenceThreshold: number) {
  const filtered = registry.conventions.filter(
    (c) => c.confidence >= confidenceThreshold
  );

  const commands = extractCommands(filtered);

  const byCategory = (cat: string): ConventionEntry[] =>
    filtered.filter((c) => c.category === cat);

  const testingConventions = byCategory("testing");
  const namingConventions = byCategory("naming");
  const importConventions = byCategory("imports");
  const gitConventions = filtered.filter(
    (c) =>
      c.pattern.toLowerCase().includes("git") ||
      (c.category === "other" && c.pattern.toLowerCase().includes("commit"))
  );

  const hasTesting =
    Boolean(registry.stack.testRunner) || testingConventions.length > 0;

  const hasProjectStructure =
    Boolean(registry.architecture.pattern) ||
    (registry.architecture.layers?.length ?? 0) > 0;

  const hasCodeStyle =
    namingConventions.length > 0 || importConventions.length > 0;

  return {
    commands,
    testRunner: registry.stack.testRunner ?? null,
    testingConventions,
    namingConventions,
    importConventions,
    gitConventions,
    architecture: registry.architecture,
    hasTesting,
    hasProjectStructure,
    hasCodeStyle,
  };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function renderAgentsMd(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const data = prepData(registry, confidenceThreshold);
  const lines: string[] = [];

  lines.push("# AGENTS.md");

  // Commands section
  if (data.commands.length > 0) {
    lines.push("");
    lines.push("## Commands");
    for (const cmd of data.commands) {
      lines.push(`- \`${cmd.scriptName}\`: \`${cmd.command}\``);
    }
  }

  // Testing section
  if (data.hasTesting) {
    lines.push("");
    lines.push("## Testing");
    if (data.testRunner) lines.push(`- Test runner: ${data.testRunner}`);
    for (const entry of data.testingConventions) {
      if (isRedundantConvention(entry)) continue;
      lines.push(`- ${entry.pattern}`);
    }
  }

  // Project Structure section
  if (data.hasProjectStructure) {
    lines.push("");
    lines.push("## Project Structure");
    if (data.architecture.pattern) {
      lines.push(`- Architecture: ${data.architecture.pattern}`);
    }
    if (data.architecture.layers && data.architecture.layers.length > 0) {
      lines.push(`- Layers: ${data.architecture.layers.join(", ")}`);
    }
  }

  // Code Style section
  if (data.hasCodeStyle) {
    lines.push("");
    lines.push("## Code Style");
    for (const entry of data.namingConventions) {
      lines.push(`- **naming**: ${entry.pattern}`);
    }
    for (const entry of data.importConventions) {
      lines.push(`- **imports**: ${entry.pattern}`);
    }
  }

  // Git Workflow section (optional)
  if (data.gitConventions.length > 0) {
    lines.push("");
    lines.push("## Git Workflow");
    for (const entry of data.gitConventions) {
      lines.push(`- ${entry.pattern}`);
    }
  }

  // Boundaries section (always present)
  lines.push("");
  lines.push("## Boundaries");
  lines.push("- Do not modify auto-generated sections between ez-context markers");

  return lines.join("\n") + "\n";
}
