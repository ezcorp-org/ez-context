import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import type { ConventionRegistry } from "../core/schema.js";
import type { EmitOptions, EmitResult, OutputFormat } from "./types.js";
import { writeWithMarkers } from "./writer.js";
import { renderClaudeMd } from "./claude-md.js";
import { renderAgentsMd } from "./agents-md.js";
import { renderCursorMdc } from "./cursor-mdc.js";
import { renderCopilotMd } from "./copilot-md.js";
import { renderSkillMd } from "./skill-md.js";
import { renderRulesyncMd } from "./rulesync-md.js";
import { renderRulerMd } from "./ruler-md.js";

export { renderClaudeMd } from "./claude-md.js";
export { renderAgentsMd } from "./agents-md.js";
export { renderCursorMdc } from "./cursor-mdc.js";
export { renderCopilotMd } from "./copilot-md.js";
export { renderSkillMd } from "./skill-md.js";
export { renderRulesyncMd } from "./rulesync-md.js";
export { renderRulerMd } from "./ruler-md.js";
export type { OutputFormat } from "./types.js";

// ---------------------------------------------------------------------------
// Format emitter registry
// ---------------------------------------------------------------------------

type WriteStrategy = "markers" | "direct";

interface FormatEmitterEntry {
  render: (registry: ConventionRegistry, threshold: number) => string;
  filename: string;
  strategy: WriteStrategy;
}

export const FORMAT_EMITTER_MAP: Record<OutputFormat, FormatEmitterEntry> = {
  claude: {
    render: renderClaudeMd,
    filename: "CLAUDE.md",
    strategy: "markers",
  },
  agents: {
    render: renderAgentsMd,
    filename: "AGENTS.md",
    strategy: "markers",
  },
  cursor: {
    render: renderCursorMdc,
    filename: path.join(".cursor", "rules", "ez-context.mdc"),
    strategy: "direct",
  },
  copilot: {
    render: renderCopilotMd,
    filename: path.join(".github", "copilot-instructions.md"),
    strategy: "markers",
  },
  skills: {
    render: renderSkillMd,
    filename: path.join(".skills", "ez-context", "SKILL.md"),
    strategy: "direct",
  },
  rulesync: {
    render: renderRulesyncMd,
    filename: path.join(".rulesync", "rules", "ez-context.md"),
    strategy: "markers",
  },
  ruler: {
    render: renderRulerMd,
    filename: path.join(".ruler", "ez-context.md"),
    strategy: "direct",
  },
};

// ---------------------------------------------------------------------------
// emit()
// ---------------------------------------------------------------------------

/**
 * Emit output files for the given ConventionRegistry.
 *
 * Defaults to ["claude", "agents"] for backward compatibility.
 * In dryRun mode, returns rendered content without writing any files.
 */
export async function emit(
  registry: ConventionRegistry,
  options: EmitOptions
): Promise<EmitResult> {
  const threshold = options.confidenceThreshold ?? 0.7;
  const formats: OutputFormat[] = options.formats ?? ["claude", "agents"];

  // Render all requested formats
  const rendered: Record<string, string> = {};
  for (const format of formats) {
    const entry = FORMAT_EMITTER_MAP[format];
    rendered[format] = entry.render(registry, threshold);
  }

  // Backward compat aliases
  const claudeMd = rendered["claude"] ?? "";
  const agentsMd = rendered["agents"] ?? "";

  if (options.dryRun) {
    return { rendered, claudeMd, agentsMd, filesWritten: [] };
  }

  // Write files
  const filesWritten: string[] = [];
  for (const format of formats) {
    const entry = FORMAT_EMITTER_MAP[format];
    const filePath = path.join(options.outputDir, entry.filename);

    await mkdir(path.dirname(filePath), { recursive: true });
    if (entry.strategy === "direct") {
      await writeFile(filePath, rendered[format]!, "utf-8");
    } else {
      await writeWithMarkers(filePath, rendered[format]!);
    }

    filesWritten.push(filePath);
  }

  return { rendered, claudeMd, agentsMd, filesWritten };
}
