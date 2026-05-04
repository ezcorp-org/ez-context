import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importsExtractor } from "../../../src/extractors/code/imports.js";

describe("importsExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-imports-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("classifies predominantly relative imports (relRatio >= 0.75)", async () => {
    // 3 relative imports, 1 external → ratio = 0.75
    await writeFile(
      join(tempDir, "a.ts"),
      `import { x } from "./b";\nimport { y } from "./c";\nimport { z } from "./d";`
    );
    await writeFile(join(tempDir, "b.ts"), "export const x = 1;");
    await writeFile(join(tempDir, "c.ts"), "export const y = 2;");
    await writeFile(join(tempDir, "d.ts"), "export const z = 3;");
    await writeFile(join(tempDir, "e.ts"), `import { lodash } from "lodash";`);

    const entries = await importsExtractor.extract({ projectPath: tempDir });

    const orgEntry = entries.find((e) => e.pattern.includes("relative"));
    expect(orgEntry).toBeDefined();
    expect(orgEntry!.category).toBe("imports");
    expect(orgEntry!.pattern).toContain("Predominantly relative");
    expect(orgEntry!.metadata?.relativeRatio).toBeGreaterThanOrEqual(0.75);
  });

  it("classifies predominantly external imports (relRatio <= 0.25)", async () => {
    // 1 relative, 3 external → ratio = 0.25
    await writeFile(
      join(tempDir, "main.ts"),
      `import { foo } from "react";\nimport { bar } from "lodash";\nimport { baz } from "express";\nimport { local } from "./local";`
    );
    await writeFile(join(tempDir, "local.ts"), "export const local = 1;");

    const entries = await importsExtractor.extract({ projectPath: tempDir });

    const orgEntry = entries.find((e) => e.pattern.includes("external"));
    expect(orgEntry).toBeDefined();
    expect(orgEntry!.pattern).toContain("Predominantly external");
    expect(orgEntry!.metadata?.relativeRatio).toBeLessThanOrEqual(0.25);
  });

  it("classifies mix of relative and external imports", async () => {
    // 2 relative, 2 external → ratio = 0.5
    await writeFile(
      join(tempDir, "app.ts"),
      `import { a } from "./utils";\nimport { b } from "./helpers";\nimport { c } from "react";\nimport { d } from "lodash";`
    );
    await writeFile(join(tempDir, "utils.ts"), "export const a = 1;");
    await writeFile(join(tempDir, "helpers.ts"), "export const b = 2;");

    const entries = await importsExtractor.extract({ projectPath: tempDir });

    const orgEntry = entries.find((e) => e.pattern.includes("Mix"));
    expect(orgEntry).toBeDefined();
    expect(orgEntry!.pattern).toBe("Mix of relative and external imports");
  });

  it("detects path alias usage (@/ prefix)", async () => {
    await writeFile(
      join(tempDir, "app.ts"),
      `import { helper } from "@/utils/helper";\nimport { config } from "@/config";`
    );

    const entries = await importsExtractor.extract({ projectPath: tempDir });

    const aliasEntry = entries.find((e) => e.pattern.includes("path aliases"));
    expect(aliasEntry).toBeDefined();
    expect(aliasEntry!.category).toBe("imports");
    expect(aliasEntry!.confidence).toBe(1.0);
    expect(aliasEntry!.metadata?.aliasCount).toBe(2);
  });

  it("detects barrel file imports", async () => {
    // Create a barrel index file (only re-exports, no declarations)
    await writeFile(
      join(tempDir, "index.ts"),
      `export { foo } from "./foo";\nexport { bar } from "./bar";`
    );
    await writeFile(join(tempDir, "foo.ts"), "export const foo = 1;");
    await writeFile(join(tempDir, "bar.ts"), "export const bar = 2;");
    // File that imports from the barrel
    await writeFile(
      join(tempDir, "consumer.ts"),
      `import { foo, bar } from "./index";`
    );

    const entries = await importsExtractor.extract({ projectPath: tempDir });

    const barrelEntry = entries.find((e) => e.pattern.includes("barrel"));
    expect(barrelEntry).toBeDefined();
    expect(barrelEntry!.category).toBe("imports");
    expect(barrelEntry!.metadata?.barrelCount).toBeGreaterThan(0);
  });

  it("respects maxFilesForAst option to limit files analyzed", async () => {
    // Create 3 files with imports
    await writeFile(join(tempDir, "a.ts"), `import { x } from "react";`);
    await writeFile(join(tempDir, "b.ts"), `import { y } from "lodash";`);
    await writeFile(join(tempDir, "c.ts"), `import { z } from "express";`);

    // Limit to 1 file
    const entries = await importsExtractor.extract({
      projectPath: tempDir,
      options: { maxFilesForAst: 1 },
    });

    // Should still produce entries (1 file has 1 external import)
    const orgEntry = entries.find((e) => e.category === "imports");
    expect(orgEntry).toBeDefined();
    expect(orgEntry!.metadata?.totalImports).toBe(1);
  });

  it("returns [] when no source files found", async () => {
    const entries = await importsExtractor.extract({ projectPath: tempDir });
    expect(entries).toEqual([]);
  });

  it("returns [] when files have no imports", async () => {
    await writeFile(join(tempDir, "empty.ts"), "export const x = 1;");

    const entries = await importsExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });

  it("metadata includes relativeCount, externalCount, totalImports, relativeRatio", async () => {
    await writeFile(
      join(tempDir, "main.ts"),
      `import { a } from "./local";\nimport { b } from "react";`
    );
    await writeFile(join(tempDir, "local.ts"), "export const a = 1;");

    const entries = await importsExtractor.extract({ projectPath: tempDir });

    const orgEntry = entries.find((e) => e.metadata?.totalImports !== undefined);
    expect(orgEntry).toBeDefined();
    expect(orgEntry!.metadata).toMatchObject({
      relativeCount: 1,
      externalCount: 1,
      totalImports: 2,
      relativeRatio: 0.5,
    });
  });
});
