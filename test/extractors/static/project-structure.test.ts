import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectStructureExtractor } from "../../../src/extractors/static/project-structure.js";

describe("projectStructureExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-projstruct-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects co-located *.test.ts files", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(join(tempDir, "src", "utils.test.ts"), "");
    await writeFile(join(tempDir, "src", "api.test.ts"), "");

    const entries = await projectStructureExtractor.extract({ projectPath: tempDir });

    const testEntry = entries.find((e) => e.pattern.includes("*.test.ts style"));
    expect(testEntry).toBeDefined();
    expect(testEntry!.category).toBe("testing");
    expect(testEntry!.metadata?.style).toBe("*.test.ts style");
    expect(testEntry!.metadata?.testFileCount).toBe(2);
  });

  it("detects test/ directory pattern", async () => {
    await mkdir(join(tempDir, "test"), { recursive: true });
    await writeFile(join(tempDir, "test", "utils.ts"), "");
    await writeFile(join(tempDir, "test", "api.ts"), "");
    await writeFile(join(tempDir, "test", "core.ts"), "");

    const entries = await projectStructureExtractor.extract({ projectPath: tempDir });

    const testDirEntry = entries.find((e) => e.metadata?.location === "test/ directory");
    expect(testDirEntry).toBeDefined();
    expect(testDirEntry!.metadata?.testFileCount).toBe(3);
  });

  it("confidence scales with file count (saturates at 0.95)", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    // 9 files → 0.5 + 9*0.05 = 0.95 (exact cap)
    for (let i = 0; i < 9; i++) {
      await writeFile(join(tempDir, "src", `file${i}.test.ts`), "");
    }

    const entries = await projectStructureExtractor.extract({ projectPath: tempDir });

    const testEntry = entries.find((e) => e.pattern.includes("*.test.ts style"));
    expect(testEntry).toBeDefined();
    expect(testEntry!.confidence).toBe(0.95);
  });

  it("confidence is lower for fewer test files", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    // 1 file → 0.5 + 1*0.05 = 0.55
    await writeFile(join(tempDir, "src", "only.test.ts"), "");

    const entries = await projectStructureExtractor.extract({ projectPath: tempDir });

    const testEntry = entries.find((e) => e.pattern.includes("*.test.ts style"));
    expect(testEntry).toBeDefined();
    expect(testEntry!.confidence).toBeCloseTo(0.55);
  });

  it("evidence is capped at 5 files even when more match", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    for (let i = 0; i < 10; i++) {
      await writeFile(join(tempDir, "src", `file${i}.test.ts`), "");
    }

    const entries = await projectStructureExtractor.extract({ projectPath: tempDir });

    const testEntry = entries.find((e) => e.pattern.includes("*.test.ts style"));
    expect(testEntry).toBeDefined();
    expect(testEntry!.evidence.length).toBe(5);
    expect(testEntry!.metadata?.testFileCount).toBe(10);
  });

  it("detects *.spec.ts style", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(join(tempDir, "src", "service.spec.ts"), "");

    const entries = await projectStructureExtractor.extract({ projectPath: tempDir });

    const specEntry = entries.find((e) => e.pattern.includes("*.spec.ts style"));
    expect(specEntry).toBeDefined();
    expect(specEntry!.metadata?.location).toBe("co-located");
  });

  it("returns [] when no test files found", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(join(tempDir, "src", "utils.ts"), "export function foo() {}");

    const entries = await projectStructureExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });
});
