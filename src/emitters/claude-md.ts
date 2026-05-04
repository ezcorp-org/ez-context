import type { ConventionRegistry, ConventionEntry } from "../core/schema.js";
import { isRedundantConvention } from "./render-helpers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConventionGroup {
  category: string;
  entries: ConventionEntry[];
}

// ---------------------------------------------------------------------------
// Data prep
// ---------------------------------------------------------------------------

function prepData(registry: ConventionRegistry, confidenceThreshold: number) {
  const filtered = registry.conventions.filter(
    (c) => c.confidence >= confidenceThreshold
  );

  // Group by category, excluding architecture and entries redundant with Stack/Commands.
  // Stack entries not covered by StackInfo fields (e.g. "TypeScript strict mode") are kept.
  const categoryMap = new Map<string, ConventionEntry[]>();
  for (const entry of filtered) {
    if (entry.category === "architecture") continue;
    if (entry.category === "stack") {
      const meta = entry.metadata ?? {};
      // Skip entries already rendered in the Stack section
      if (typeof meta["language"] === "string") continue;
      if (typeof meta["framework"] === "string") continue;
      if (typeof meta["buildTool"] === "string") continue;
      if (typeof meta["packageManager"] === "string") continue;
      if (typeof meta["scriptName"] === "string") continue;
    }
    if (isRedundantConvention(entry)) continue;
    const list = categoryMap.get(entry.category) ?? [];
    list.push(entry);
    categoryMap.set(entry.category, list);
  }

  const conventionGroups: ConventionGroup[] = [];
  for (const [category, entries] of categoryMap) {
    conventionGroups.push({ category, entries });
  }

  const hasStack =
    registry.stack.language !== "unknown" ||
    Boolean(registry.stack.framework) ||
    Boolean(registry.stack.buildTool) ||
    Boolean(registry.stack.packageManager) ||
    Boolean(registry.stack.testRunner);

  const hasArchitecture =
    Boolean(registry.architecture.pattern) ||
    (registry.architecture.layers?.length ?? 0) > 0;

  return {
    stack: registry.stack,
    architecture: registry.architecture,
    conventionGroups,
    hasStack,
    hasArchitecture,
  };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function renderClaudeMd(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string {
  const data = prepData(registry, confidenceThreshold);
  const lines: string[] = [];

  lines.push("# Project Context");

  // Stack section
  if (data.hasStack) {
    lines.push("");
    lines.push("## Stack");
    if (data.stack.language !== "unknown") {
      lines.push(`- Language: ${data.stack.language}`);
    }
    if (data.stack.framework) lines.push(`- Framework: ${data.stack.framework}`);
    if (data.stack.buildTool) lines.push(`- Build: ${data.stack.buildTool}`);
    if (data.stack.packageManager) lines.push(`- Package Manager: ${data.stack.packageManager}`);
    if (data.stack.testRunner) lines.push(`- Test Runner: ${data.stack.testRunner}`);
  }

  // Conventions section
  if (data.conventionGroups.length > 0) {
    lines.push("");
    lines.push("## Conventions");
    for (const group of data.conventionGroups) {
      for (const entry of group.entries) {
        lines.push(`- **${group.category}**: ${entry.pattern}`);
      }
    }
  }

  // Architecture section
  if (data.hasArchitecture) {
    lines.push("");
    lines.push("## Architecture");
    if (data.architecture.pattern) {
      lines.push(`- Pattern: ${data.architecture.pattern}`);
    }
    if (data.architecture.layers && data.architecture.layers.length > 0) {
      lines.push(`- Layers: ${data.architecture.layers.join(", ")}`);
    }
  }

  return lines.join("\n") + "\n";
}
