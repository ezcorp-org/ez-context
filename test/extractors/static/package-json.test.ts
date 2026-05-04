import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packageJsonExtractor } from "../../../src/extractors/static/package-json.js";

describe("packageJsonExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-pkg-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects TypeScript, React, and Vitest from package.json", async () => {
    const pkg = {
      dependencies: { react: "^19" },
      devDependencies: { typescript: "^5", vitest: "^3" },
      scripts: { build: "tsdown", test: "vitest" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg));

    const ctx = { projectPath: tempDir };
    const entries = await packageJsonExtractor.extract(ctx);

    // TypeScript detection
    const tsEntry = entries.find((e) => e.category === "stack" && e.metadata?.language === "TypeScript");
    expect(tsEntry).toBeDefined();
    expect(tsEntry?.confidence).toBeGreaterThan(0.8);

    // React detection
    const reactEntry = entries.find((e) => e.category === "stack" && e.metadata?.framework === "React");
    expect(reactEntry).toBeDefined();

    // Vitest detection
    const vitestEntry = entries.find((e) => e.category === "testing" && e.metadata?.testRunner === "Vitest");
    expect(vitestEntry).toBeDefined();
    expect(vitestEntry?.confidence).toBeGreaterThan(0.8);

    // Script entries
    const buildScript = entries.find((e) => e.metadata?.scriptName === "build");
    expect(buildScript).toBeDefined();
    const testScript = entries.find((e) => e.metadata?.scriptName === "test");
    expect(testScript).toBeDefined();
  });

  it("returns empty array when package.json is missing", async () => {
    const ctx = { projectPath: tempDir };
    const entries = await packageJsonExtractor.extract(ctx);
    expect(entries).toEqual([]);
  });
});
