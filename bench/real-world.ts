#!/usr/bin/env tsx
/**
 * Real-world benchmark: runs ez-context against popular OSS projects.
 *
 * Usage:  tsx bench/real-world.ts
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { extractConventions } from "../src/core/pipeline.js";
import type { ConventionRegistry } from "../src/core/schema.js";

// ---------------------------------------------------------------------------
// Target projects
// ---------------------------------------------------------------------------

interface TargetProject {
  repo: string; // "owner/name"
  expected: { language: string; packageManager?: string; naming?: string };
}

const TARGETS: TargetProject[] = [
  {
    repo: "sindresorhus/ky",
    expected: { language: "TypeScript", packageManager: "npm", naming: "camelCase" },
  },
  {
    repo: "expressjs/express",
    expected: { language: "JavaScript", packageManager: "npm", naming: "camelCase" },
  },
  {
    repo: "vitejs/vite",
    expected: { language: "TypeScript", packageManager: "pnpm", naming: "camelCase" },
  },
];

const CACHE_DIR = join(import.meta.dirname!, ".cache");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cacheDir(repo: string): string {
  return join(CACHE_DIR, repo.replace("/", "-"));
}

function ensureCloned(repo: string): void {
  const dir = cacheDir(repo);
  if (existsSync(join(dir, ".git"))) return;

  mkdirSync(dir, { recursive: true });
  const url = `https://github.com/${repo}.git`;
  execSync(`git clone --depth 1 ${url} ${dir}`, {
    stdio: "pipe",
    timeout: 60_000,
  });
}

function countByCategory(
  registry: ConventionRegistry,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of registry.conventions) {
    counts[c.category] = (counts[c.category] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Run benchmark for a single project
// ---------------------------------------------------------------------------

interface ProjectResult {
  repo: string;
  ok: boolean;
  error?: string;
  language?: string;
  framework?: string;
  testRunner?: string;
  buildTool?: string;
  packageManager?: string;
  conventionCount?: number;
  categoryCounts?: Record<string, number>;
  timeMs?: number;
}

async function benchProject(target: TargetProject): Promise<ProjectResult> {
  const { repo } = target;
  try {
    ensureCloned(repo);

    const t0 = performance.now();
    const registry = await extractConventions(cacheDir(repo));
    const elapsed = performance.now() - t0;

    const { stack, conventions } = registry;
    const cats = countByCategory(registry);

    // Validate basic expectations
    if (conventions.length === 0) {
      return { repo, ok: false, error: "No conventions extracted" };
    }
    if (stack.language === "unknown") {
      return { repo, ok: false, error: "Language detected as 'unknown'" };
    }

    return {
      repo,
      ok: true,
      language: stack.language,
      framework: stack.framework,
      testRunner: stack.testRunner,
      buildTool: stack.buildTool,
      packageManager: stack.packageManager,
      conventionCount: conventions.length,
      categoryCounts: cats,
      timeMs: Math.round(elapsed),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { repo, ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Markdown table renderer
// ---------------------------------------------------------------------------

function pad(s: string, len: number): string {
  return s.padEnd(len);
}

function renderTable(results: ProjectResult[]): string {
  const headers = ["Project", "Language", "Framework", "Test Runner", "Conventions", "Time"];
  const rows = results.map((r) => [
    r.repo,
    r.ok ? (r.language ?? "-") : "FAIL",
    r.ok ? (r.framework ?? "-") : "-",
    r.ok ? (r.testRunner ?? "-") : "-",
    r.ok ? String(r.conventionCount) : "-",
    r.ok ? `${r.timeMs}ms` : r.error ?? "unknown error",
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]!.length)),
  );

  const sep = widths.map((w) => "-".repeat(w)).join(" | ");
  const hdr = headers.map((h, i) => pad(h, widths[i]!)).join(" | ");
  const body = rows
    .map((r) => r.map((c, i) => pad(c, widths[i]!)).join(" | "))
    .join("\n| ");

  return `| ${hdr} |\n| ${sep} |\n| ${body} |`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== ez-context real-world benchmark ===\n");

  const results: ProjectResult[] = [];

  for (const target of TARGETS) {
    console.log(`> ${target.repo} ...`);
    const result = await benchProject(target);
    results.push(result);

    if (result.ok) {
      console.log(
        `  OK  lang=${result.language}  framework=${result.framework ?? "-"}  ` +
          `testRunner=${result.testRunner ?? "-"}  conventions=${result.conventionCount}  ` +
          `time=${result.timeMs}ms`,
      );
    } else {
      console.log(`  FAIL  ${result.error}`);
    }
  }

  console.log("\n" + renderTable(results) + "\n");

  // JSON summary to stdout
  const summary = {
    timestamp: new Date().toISOString(),
    results: results.map(({ repo, ok, error, language, framework, testRunner, buildTool, packageManager, conventionCount, categoryCounts, timeMs }) => ({
      repo,
      ok,
      ...(error ? { error } : {}),
      ...(ok ? { language, framework, testRunner, buildTool, packageManager, conventionCount, categoryCounts, timeMs } : {}),
    })),
    allPassed: results.every((r) => r.ok),
  };

  console.log(JSON.stringify(summary, null, 2));

  process.exit(summary.allPassed ? 0 : 1);
}

main();
