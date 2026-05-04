import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { globby } from "globby";
import { load as yamlLoad } from "js-yaml";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Entry = Omit<ConventionEntry, "id">;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CommandCategory = "stack" | "testing";

interface CommandMatch {
  command: string;
  category: CommandCategory;
  ciFile: string;
}

const BUILD_KEYWORDS = ["build", "compile", "tsc", "tsdown"];
const TEST_KEYWORDS = ["test", "vitest", "jest", "pytest", "cargo test", "go test"];
const LINT_KEYWORDS = ["lint", "eslint", "biome", "clippy", "ruff"];

function categorizeCommand(cmd: string): CommandCategory | null {
  const lower = cmd.toLowerCase();
  if (TEST_KEYWORDS.some((kw) => lower.includes(kw))) return "testing";
  if (BUILD_KEYWORDS.some((kw) => lower.includes(kw))) return "stack";
  if (LINT_KEYWORDS.some((kw) => lower.includes(kw))) return "stack";
  return null;
}

/**
 * Extract run commands from a GitHub Actions workflow YAML.
 * Traverses jobs.*.steps[].run
 */
function extractGithubActionsCommands(doc: unknown, filePath: string): { matched: CommandMatch[]; raw: string[] } {
  const matched: CommandMatch[] = [];
  const raw: string[] = [];

  if (!doc || typeof doc !== "object") return { matched, raw };
  const record = doc as Record<string, unknown>;
  const jobs = record["jobs"];
  if (!jobs || typeof jobs !== "object") return { matched, raw };

  for (const job of Object.values(jobs as Record<string, unknown>)) {
    if (!job || typeof job !== "object") continue;
    const steps = (job as Record<string, unknown>)["steps"];
    if (!Array.isArray(steps)) continue;
    for (const step of steps) {
      if (!step || typeof step !== "object") continue;
      const run = (step as Record<string, unknown>)["run"];
      if (typeof run !== "string") continue;
      // A single run block may contain multiple lines
      for (const line of run.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        raw.push(trimmed);
        const category = categorizeCommand(trimmed);
        if (category !== null) {
          matched.push({ command: trimmed, category, ciFile: filePath });
        }
      }
    }
  }

  return { matched, raw };
}

/** Keys that are not job definitions in GitLab CI top-level. */
const GITLAB_RESERVED = new Set(["stages", "variables", "include", "default", "workflow", "image", "services", "before_script", "after_script", "cache", "artifacts"]);

/**
 * Extract script commands from a GitLab CI YAML.
 * Traverses top-level job keys (skipping reserved keys), looks for script arrays.
 */
function extractGitlabCiCommands(doc: unknown, filePath: string): { matched: CommandMatch[]; raw: string[] } {
  const matched: CommandMatch[] = [];
  const raw: string[] = [];

  if (!doc || typeof doc !== "object") return { matched, raw };

  for (const [key, job] of Object.entries(doc as Record<string, unknown>)) {
    if (GITLAB_RESERVED.has(key)) continue;
    if (!job || typeof job !== "object") continue;
    const script = (job as Record<string, unknown>)["script"];
    const scripts = Array.isArray(script) ? script : typeof script === "string" ? [script] : [];
    for (const cmd of scripts) {
      if (typeof cmd !== "string") continue;
      const trimmed = cmd.trim();
      if (!trimmed) continue;
      raw.push(trimmed);
      const category = categorizeCommand(trimmed);
      if (category !== null) {
        matched.push({ command: trimmed, category, ciFile: filePath });
      }
    }
  }

  return { matched, raw };
}

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const ciExtractor: Extractor = {
  name: "ci",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const ciPatterns = [
      ".github/workflows/*.yml",
      ".github/workflows/*.yaml",
      ".gitlab-ci.yml",
    ];

    const ciFiles = await globby(ciPatterns, {
      cwd: ctx.projectPath,
      gitignore: false,
      followSymbolicLinks: false,
      absolute: false,
    });

    if (ciFiles.length === 0) return [];

    const entries: Entry[] = [];

    for (const relPath of ciFiles) {
      const absPath = join(ctx.projectPath, relPath);
      let raw: string;
      try {
        raw = await readFile(absPath, "utf-8");
      } catch {
        continue;
      }

      let doc: unknown;
      try {
        doc = yamlLoad(raw);
      } catch {
        // Malformed YAML: skip file, no throw
        continue;
      }

      const isGitlab = relPath.includes(".gitlab-ci");
      const { matched, raw: rawCmds } = isGitlab
        ? extractGitlabCiCommands(doc, relPath)
        : extractGithubActionsCommands(doc, relPath);

      // Store all raw commands in a single metadata entry per file
      if (rawCmds.length > 0 || matched.length > 0) {
        for (const { command, category } of matched) {
          entries.push({
            category,
            pattern: `CI command: ${command}`,
            confidence: 0.9,
            evidence: [{ file: relative(ctx.projectPath, absPath) || relPath, line: null }],
            metadata: { command, ciFile: relPath, rawCommands: rawCmds },
          });
        }
      }
    }

    return entries;
  },
};
