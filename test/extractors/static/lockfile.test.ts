import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lockfileExtractor } from "../../../src/extractors/static/lockfile.js";

describe("lockfileExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-lockfile-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects bun.lock with confidence 1.0", async () => {
    await writeFile(join(tempDir, "bun.lock"), "");

    const entries = await lockfileExtractor.extract({ projectPath: tempDir });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe("stack");
    expect(entries[0]!.metadata?.packageManager).toBe("bun");
    expect(entries[0]!.confidence).toBe(1.0);
    expect(entries[0]!.evidence).toEqual([{ file: "bun.lock", line: null }]);
  });

  it("detects bun.lockb (binary lockfile)", async () => {
    await writeFile(join(tempDir, "bun.lockb"), "");

    const entries = await lockfileExtractor.extract({ projectPath: tempDir });

    expect(entries[0]!.metadata?.packageManager).toBe("bun");
  });

  it("detects pnpm-lock.yaml", async () => {
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "");

    const entries = await lockfileExtractor.extract({ projectPath: tempDir });

    expect(entries[0]!.metadata?.packageManager).toBe("pnpm");
  });

  it("detects yarn.lock", async () => {
    await writeFile(join(tempDir, "yarn.lock"), "");

    const entries = await lockfileExtractor.extract({ projectPath: tempDir });

    expect(entries[0]!.metadata?.packageManager).toBe("yarn");
  });

  it("detects package-lock.json (npm)", async () => {
    await writeFile(join(tempDir, "package-lock.json"), "{}");

    const entries = await lockfileExtractor.extract({ projectPath: tempDir });

    expect(entries[0]!.metadata?.packageManager).toBe("npm");
  });

  it("prefers bun over pnpm when both are present (priority order)", async () => {
    await writeFile(join(tempDir, "bun.lock"), "");
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "");

    const entries = await lockfileExtractor.extract({ projectPath: tempDir });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.metadata?.packageManager).toBe("bun");
  });

  it("prefers pnpm over yarn when both are present", async () => {
    await writeFile(join(tempDir, "pnpm-lock.yaml"), "");
    await writeFile(join(tempDir, "yarn.lock"), "");

    const entries = await lockfileExtractor.extract({ projectPath: tempDir });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.metadata?.packageManager).toBe("pnpm");
  });

  it("returns [] when no lockfile is found", async () => {
    const entries = await lockfileExtractor.extract({ projectPath: tempDir });
    expect(entries).toEqual([]);
  });
});
