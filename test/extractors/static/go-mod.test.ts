import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { goModExtractor } from "../../../src/extractors/static/go-mod.js";

describe("goModExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-gomod-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("extracts module name and go version", async () => {
    const content = `module github.com/example/myapp\n\ngo 1.21\n`;
    await writeFile(join(tempDir, "go.mod"), content);

    const entries = await goModExtractor.extract({ projectPath: tempDir });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe("stack");
    expect(entries[0]!.pattern).toContain("github.com/example/myapp");
    expect(entries[0]!.confidence).toBe(1.0);
    expect(entries[0]!.metadata?.language).toBe("Go");
    expect(entries[0]!.metadata?.moduleName).toBe("github.com/example/myapp");
    expect(entries[0]!.metadata?.goVersion).toBe("1.21");
    expect(entries[0]!.evidence).toEqual([{ file: "go.mod", line: null }]);
  });

  it("counts dependencies from multi-line require block", async () => {
    const content = `module github.com/example/myapp\n\ngo 1.21\n\nrequire (\n\tgithub.com/pkg/errors v0.9.1\n\tgithub.com/stretchr/testify v1.8.0\n\tgolang.org/x/sync v0.3.0\n)\n`;
    await writeFile(join(tempDir, "go.mod"), content);

    const entries = await goModExtractor.extract({ projectPath: tempDir });

    expect(entries[0]!.metadata?.dependencyCount).toBe(3);
  });

  it("counts single-line require statements", async () => {
    const content = `module github.com/example/myapp\n\ngo 1.21\n\nrequire github.com/pkg/errors v0.9.1\nrequire github.com/stretchr/testify v1.8.0\n`;
    await writeFile(join(tempDir, "go.mod"), content);

    const entries = await goModExtractor.extract({ projectPath: tempDir });

    expect(entries[0]!.metadata?.dependencyCount).toBe(2);
  });

  it("handles missing go version line", async () => {
    const content = `module github.com/example/myapp\n`;
    await writeFile(join(tempDir, "go.mod"), content);

    const entries = await goModExtractor.extract({ projectPath: tempDir });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.metadata?.goVersion).toBeNull();
  });

  it("returns [] when go.mod is missing", async () => {
    const entries = await goModExtractor.extract({ projectPath: tempDir });
    expect(entries).toEqual([]);
  });
});
