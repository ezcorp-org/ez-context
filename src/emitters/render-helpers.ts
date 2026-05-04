// Shared rendering helpers for all emitter modules
import type { ConventionRegistry, ConventionEntry } from "../core/schema.js";

/**
 * Extract script commands from a filtered list of convention entries.
 * Shared by agents-md and renderConventionsBody.
 */
export function extractCommands(
  filtered: ConventionEntry[]
): Array<{ scriptName: string; command: string }> {
  const commands: Array<{ scriptName: string; command: string }> = [];
  for (const entry of filtered) {
    const meta = entry.metadata;
    if (
      meta &&
      typeof meta["command"] === "string" &&
      typeof meta["scriptName"] === "string"
    ) {
      commands.push({
        scriptName: meta["scriptName"] as string,
        command: meta["command"] as string,
      });
    }
  }
  return commands;
}

/**
 * Check if a stack-category convention should appear in the Conventions section.
 * Stack entries that map to StackInfo fields (language, framework, etc.) are already
 * shown in the Stack section. Others (e.g. "TypeScript strict mode") are convention-worthy.
 */
function isStackConventionWorthy(
  entry: ConventionEntry,
  stack: ConventionRegistry["stack"]
): boolean {
  if (entry.category !== "stack") return false;
  const meta = entry.metadata ?? {};
  // Already represented in Stack section via StackInfo fields
  if (typeof meta["language"] === "string" && stack.language !== "unknown") return false;
  if (typeof meta["framework"] === "string" && stack.framework) return false;
  if (typeof meta["buildTool"] === "string" && stack.buildTool) return false;
  if (typeof meta["packageManager"] === "string" && stack.packageManager) return false;
  // Script entries are shown in Commands section
  if (typeof meta["scriptName"] === "string") return false;
  // Everything else (strict mode, compiler options, etc.) is convention-worthy
  return true;
}

/**
 * Check if a convention entry is redundant with the Stack or Commands sections.
 * - "Test runner: X" in testing category duplicates Stack > Test Runner
 * - Entries with metadata.scriptName duplicate the Commands section
 */
export function isRedundantConvention(entry: ConventionEntry): boolean {
  if (entry.category === "testing" && entry.pattern.startsWith("Test runner:")) {
    return true;
  }
  if (entry.metadata && typeof entry.metadata["scriptName"] === "string") {
    return true;
  }
  return false;
}

/**
 * Render conventions body as markdown lines.
 * Used by cursor-mdc, skill-md, rulesync-md, ruler-md, copilot-md.
 */
export function renderConventionsBody(
  registry: ConventionRegistry,
  confidenceThreshold: number
): string[] {
  const filtered = registry.conventions.filter(
    (c) => c.confidence >= confidenceThreshold
  );

  const lines: string[] = [];

  // Stack section
  const s = registry.stack;
  const hasStack =
    s.language !== "unknown" ||
    Boolean(s.framework) ||
    Boolean(s.buildTool) ||
    Boolean(s.packageManager) ||
    Boolean(s.testRunner);

  if (hasStack) {
    lines.push("## Stack");
    if (s.language !== "unknown") lines.push(`- Language: ${s.language}`);
    if (s.framework) lines.push(`- Framework: ${s.framework}`);
    if (s.buildTool) lines.push(`- Build: ${s.buildTool}`);
    if (s.packageManager) lines.push(`- Package Manager: ${s.packageManager}`);
    if (s.testRunner) lines.push(`- Test Runner: ${s.testRunner}`);
    lines.push("");
  }

  // Architecture section
  const a = registry.architecture;
  const hasArchitecture =
    Boolean(a.pattern) || (a.layers?.length ?? 0) > 0;

  if (hasArchitecture) {
    lines.push("## Architecture");
    if (a.pattern) lines.push(`- Pattern: ${a.pattern}`);
    if (a.layers && a.layers.length > 0) {
      lines.push(`- Layers: ${a.layers.join(", ")}`);
    }
    lines.push("");
  }

  // Conventions section — group by category, exclude architecture and redundant entries.
  // Stack entries without scriptName are kept (e.g. "TypeScript strict mode enabled").
  const categoryMap = new Map<string, string[]>();
  for (const entry of filtered) {
    if (entry.category === "architecture") continue;
    if (entry.category === "stack" && !isStackConventionWorthy(entry, s)) continue;
    if (isRedundantConvention(entry)) continue;
    const list = categoryMap.get(entry.category) ?? [];
    list.push(entry.pattern);
    categoryMap.set(entry.category, list);
  }

  if (categoryMap.size > 0) {
    lines.push("## Conventions");
    for (const [category, patterns] of categoryMap) {
      for (const pattern of patterns) {
        lines.push(`- **${category}**: ${pattern}`);
      }
    }
    lines.push("");
  }

  // Commands section — from conventions with metadata.command + metadata.scriptName
  const commands = extractCommands(filtered);

  if (commands.length > 0) {
    lines.push("## Commands");
    for (const cmd of commands) {
      lines.push(`- \`${cmd.scriptName}\`: \`${cmd.command}\``);
    }
    lines.push("");
  }

  return lines;
}
