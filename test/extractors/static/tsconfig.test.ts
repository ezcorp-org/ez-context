import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tsconfigExtractor } from "../../../src/extractors/static/tsconfig.js";

describe("tsconfigExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-tsconfig-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects strict mode", async () => {
    await writeFile(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true } })
    );

    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });

    const strictEntry = entries.find((e) => e.pattern.includes("strict mode"));
    expect(strictEntry).toBeDefined();
    expect(strictEntry!.category).toBe("stack");
    expect(strictEntry!.confidence).toBe(1.0);
    expect(strictEntry!.metadata?.strict).toBe(true);
    expect(strictEntry!.evidence).toEqual([{ file: "tsconfig.json", line: null }]);
  });

  it("does not emit strict entry when strict is false", async () => {
    await writeFile(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: false, target: "ES2022" } })
    );

    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });

    const strictEntry = entries.find((e) => e.pattern.includes("strict mode"));
    expect(strictEntry).toBeUndefined();
  });

  it("detects compiler options (target, module, moduleResolution)", async () => {
    await writeFile(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
        },
      })
    );

    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });

    const optionsEntry = entries.find((e) => e.pattern.includes("compiler options"));
    expect(optionsEntry).toBeDefined();
    expect(optionsEntry!.category).toBe("stack");
    expect(optionsEntry!.confidence).toBe(1.0);
    expect(optionsEntry!.metadata?.target).toBe("ES2022");
    expect(optionsEntry!.metadata?.module).toBe("ESNext");
    expect(optionsEntry!.metadata?.moduleResolution).toBe("bundler");
  });

  it("detects path aliases", async () => {
    await writeFile(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          paths: {
            "@/*": ["./src/*"],
            "~/*": ["./src/*"],
          },
        },
      })
    );

    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });

    const aliasEntry = entries.find((e) => e.category === "imports");
    expect(aliasEntry).toBeDefined();
    expect(aliasEntry!.pattern).toContain("path aliases");
    expect(aliasEntry!.confidence).toBe(1.0);
    expect(aliasEntry!.metadata?.aliases).toMatchObject({
      "@/*": ["./src/*"],
      "~/*": ["./src/*"],
    });
  });

  it("strips // comments before parsing", async () => {
    const raw = `{
      // strict mode enabled
      "compilerOptions": {
        "strict": true,
        "target": "ES2022" // modern target
      }
    }`;
    await writeFile(join(tempDir, "tsconfig.json"), raw);

    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });

    const strictEntry = entries.find((e) => e.metadata?.strict === true);
    expect(strictEntry).toBeDefined();
  });

  it("strips trailing commas before parsing", async () => {
    const raw = `{
      "compilerOptions": {
        "strict": true,
        "target": "ES2022",
      }
    }`;
    await writeFile(join(tempDir, "tsconfig.json"), raw);

    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });

    const strictEntry = entries.find((e) => e.metadata?.strict === true);
    expect(strictEntry).toBeDefined();
  });

  it("returns [] when tsconfig.json is missing", async () => {
    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });
    expect(entries).toEqual([]);
  });

  it("returns [] for malformed JSON (after stripping)", async () => {
    await writeFile(join(tempDir, "tsconfig.json"), "{ invalid json !!!");

    const entries = await tsconfigExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });
});
