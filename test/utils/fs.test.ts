import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listProjectFiles, ALWAYS_SKIP } from "../../src/utils/fs.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ez-context-fs-test-"));
}

function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function touch(filePath: string, content = ""): void {
  writeFileSync(filePath, content);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("listProjectFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("lists TypeScript files in a temp directory", async () => {
    touch(join(tempDir, "index.ts"), "export {}");
    touch(join(tempDir, "utils.ts"), "export {}");
    const files = await listProjectFiles({ cwd: tempDir });
    expect(files).toContain("index.ts");
    expect(files).toContain("utils.ts");
  });

  it("lists only the requested extensions", async () => {
    touch(join(tempDir, "main.ts"));
    touch(join(tempDir, "main.py"));
    const files = await listProjectFiles({ cwd: tempDir, extensions: ["ts"] });
    expect(files).toContain("main.ts");
    expect(files).not.toContain("main.py");
  });

  it("skips node_modules/ directory", async () => {
    mkdirSync(join(tempDir, "node_modules", "some-pkg"), { recursive: true });
    touch(join(tempDir, "node_modules", "some-pkg", "index.ts"));
    touch(join(tempDir, "real.ts"));
    const files = await listProjectFiles({ cwd: tempDir });
    const hasNodeModules = files.some((f) => f.includes("node_modules"));
    expect(hasNodeModules).toBe(false);
    expect(files).toContain("real.ts");
  });

  it("skips dist/ directory", async () => {
    mkdirSync(join(tempDir, "dist"), { recursive: true });
    touch(join(tempDir, "dist", "bundle.js"));
    touch(join(tempDir, "src.ts"));
    const files = await listProjectFiles({ cwd: tempDir });
    const hasDist = files.some((f) => f.includes("dist/"));
    expect(hasDist).toBe(false);
  });

  it("skips generated/ directory", async () => {
    mkdirSync(join(tempDir, "generated"), { recursive: true });
    touch(join(tempDir, "generated", "types.ts"));
    touch(join(tempDir, "app.ts"));
    const files = await listProjectFiles({ cwd: tempDir });
    const hasGenerated = files.some((f) => f.includes("generated/"));
    expect(hasGenerated).toBe(false);
    expect(files).toContain("app.ts");
  });

  it("respects .gitignore patterns", async () => {
    writeFileSync(join(tempDir, ".gitignore"), "ignored.ts\n");
    touch(join(tempDir, "ignored.ts"));
    touch(join(tempDir, "included.ts"));
    const files = await listProjectFiles({ cwd: tempDir });
    expect(files).not.toContain("ignored.ts");
    expect(files).toContain("included.ts");
  });

  it("respects additionalIgnore patterns", async () => {
    touch(join(tempDir, "skip-me.ts"));
    touch(join(tempDir, "keep-me.ts"));
    const files = await listProjectFiles({
      cwd: tempDir,
      additionalIgnore: ["**/skip-me.ts"],
    });
    expect(files).not.toContain("skip-me.ts");
    expect(files).toContain("keep-me.ts");
  });

  it("returns paths sorted alphabetically", async () => {
    touch(join(tempDir, "z.ts"));
    touch(join(tempDir, "a.ts"));
    touch(join(tempDir, "m.ts"));
    const files = await listProjectFiles({ cwd: tempDir });
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });

  it("returns relative paths (not absolute)", async () => {
    touch(join(tempDir, "foo.ts"));
    const files = await listProjectFiles({ cwd: tempDir });
    for (const f of files) {
      expect(f).not.toMatch(/^\//);
    }
  });
});

describe("ALWAYS_SKIP", () => {
  it("is an array of strings", () => {
    expect(Array.isArray(ALWAYS_SKIP)).toBe(true);
    for (const pattern of ALWAYS_SKIP) {
      expect(typeof pattern).toBe("string");
    }
  });

  it("includes node_modules, dist, generated, .ez-search, .git", () => {
    const joined = ALWAYS_SKIP.join(" ");
    expect(joined).toContain("node_modules");
    expect(joined).toContain("dist");
    expect(joined).toContain("generated");
    expect(joined).toContain(".ez-search");
    expect(joined).toContain(".git");
  });
});
