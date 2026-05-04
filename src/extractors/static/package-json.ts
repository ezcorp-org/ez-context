import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

// ---------------------------------------------------------------------------
// Detection maps
// ---------------------------------------------------------------------------

const FRAMEWORK_MAP: Record<string, string> = {
  react: "React",
  vue: "Vue",
  "@angular/core": "Angular",
  next: "Next.js",
  nuxt: "Nuxt",
  svelte: "Svelte",
  hono: "Hono",
  express: "Express",
  fastify: "Fastify",
  koa: "Koa",
};

const TEST_RUNNER_MAP: Record<string, string> = {
  vitest: "Vitest",
  jest: "Jest",
  mocha: "Mocha",
  jasmine: "Jasmine",
  ava: "Ava",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  type?: string;
  packageManager?: string;
};

function allDeps(pkg: PackageJson): Record<string, string> {
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

type Entry = Omit<ConventionEntry, "id">;

const EVIDENCE = [{ file: "package.json", line: null }];

// ---------------------------------------------------------------------------
// Extractor
// ---------------------------------------------------------------------------

export const packageJsonExtractor: Extractor = {
  name: "package-json",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const filePath = join(ctx.projectPath, "package.json");

    try {
      await access(filePath);
    } catch {
      return [];
    }

    let pkg: PackageJson;
    try {
      const raw = await readFile(filePath, "utf-8");
      pkg = JSON.parse(raw) as PackageJson;
    } catch {
      return [];
    }

    const deps = allDeps(pkg);
    const entries: Entry[] = [];

    // --- Language detection ---
    const isTypeScript =
      "typescript" in deps || "@types/node" in deps;
    const language = isTypeScript ? "TypeScript" : "JavaScript";
    entries.push({
      category: "stack",
      pattern: `Language: ${language}`,
      confidence: 0.95,
      evidence: EVIDENCE,
      metadata: { language },
    });

    // --- Framework detection ---
    for (const [pkg_name, label] of Object.entries(FRAMEWORK_MAP)) {
      if (pkg_name in deps) {
        const version = deps[pkg_name];
        entries.push({
          category: "stack",
          pattern: `Framework: ${label}`,
          confidence: 1.0,
          evidence: EVIDENCE,
          metadata: { framework: label, version },
        });
        break; // first match wins
      }
    }

    // --- Test runner detection ---
    for (const [pkg_name, label] of Object.entries(TEST_RUNNER_MAP)) {
      if (pkg_name in deps) {
        entries.push({
          category: "testing",
          pattern: `Test runner: ${label}`,
          confidence: 0.95,
          evidence: EVIDENCE,
          metadata: { testRunner: label },
        });
        break; // first match wins
      }
    }

    // --- Package manager detection (corepack "packageManager" field) ---
    if (typeof pkg.packageManager === "string") {
      const pmName = pkg.packageManager.split("@")[0];
      if (pmName) {
        entries.push({
          category: "stack",
          pattern: `Package manager: ${pmName}`,
          confidence: 1.0,
          evidence: EVIDENCE,
          metadata: { packageManager: pmName },
        });
      }
    }

    // --- ESM module system detection ---
    if (pkg.type === "module") {
      entries.push({
        category: "imports",
        pattern: `ES modules (package.json "type": "module")`,
        confidence: 1.0,
        evidence: EVIDENCE,
        metadata: { moduleSystem: "esm" },
      });
    }

    // --- Scripts ---
    const scripts = pkg.scripts ?? {};
    for (const [scriptName, command] of Object.entries(scripts)) {
      const isTestScript =
        scriptName === "test" || scriptName.startsWith("test:");
      const isBuildOrLint =
        scriptName === "build" || scriptName === "lint";

      if (isTestScript || isBuildOrLint) {
        entries.push({
          category: isTestScript ? "testing" : "stack",
          pattern: `Script "${scriptName}": ${command}`,
          confidence: 1.0,
          evidence: EVIDENCE,
          metadata: { scriptName, command },
        });
      }
    }

    return entries;
  },
};
