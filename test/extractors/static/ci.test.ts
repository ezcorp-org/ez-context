import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ciExtractor } from "../../../src/extractors/static/ci.js";

describe("ciExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-ci-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("extracts run commands from GitHub Actions and categorizes them", async () => {
    const workflow = `name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Build
        run: bun run build
      - name: Test
        run: bun run test
`;
    await mkdir(join(tempDir, ".github", "workflows"), { recursive: true });
    await writeFile(join(tempDir, ".github", "workflows", "ci.yml"), workflow);

    const entries = await ciExtractor.extract({ projectPath: tempDir });

    expect(entries.length).toBeGreaterThan(0);
    const testEntry = entries.find((e) => e.category === "testing");
    expect(testEntry).toBeDefined();
    expect(testEntry!.confidence).toBe(0.9);
    expect(testEntry!.pattern).toContain("bun run test");

    const buildEntry = entries.find((e) => e.category === "stack");
    expect(buildEntry).toBeDefined();
    expect(buildEntry!.pattern).toContain("bun run build");
  });

  it("handles multi-line run blocks (pipe syntax)", async () => {
    const workflow = `name: CI
on: push
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - name: Setup and test
        run: |
          bun install
          bun run test
          bun run build
`;
    await mkdir(join(tempDir, ".github", "workflows"), { recursive: true });
    await writeFile(join(tempDir, ".github", "workflows", "ci.yml"), workflow);

    const entries = await ciExtractor.extract({ projectPath: tempDir });

    const testEntry = entries.find((e) => e.category === "testing");
    expect(testEntry).toBeDefined();

    const buildEntry = entries.find((e) => e.category === "stack");
    expect(buildEntry).toBeDefined();

    // rawCommands metadata should include all lines from the block
    expect(testEntry!.metadata?.rawCommands).toEqual(
      expect.arrayContaining(["bun install", "bun run test", "bun run build"])
    );
  });

  it("extracts script arrays from GitLab CI job definitions", async () => {
    const gitlabCi = `stages:
  - test
  - build

test_job:
  stage: test
  script:
    - bun run test
    - bun run lint

build_job:
  stage: build
  script:
    - bun run build
`;
    await writeFile(join(tempDir, ".gitlab-ci.yml"), gitlabCi);

    const entries = await ciExtractor.extract({ projectPath: tempDir });

    expect(entries.length).toBeGreaterThan(0);
    const testEntry = entries.find((e) => e.category === "testing");
    expect(testEntry).toBeDefined();

    const buildEntry = entries.find((e) => e.category === "stack");
    expect(buildEntry).toBeDefined();
  });

  it("skips GitLab CI reserved keys (stages, variables, etc.)", async () => {
    const gitlabCi = `stages:
  - test

variables:
  FOO: bar

my_job:
  stage: test
  script:
    - bun run test
`;
    await writeFile(join(tempDir, ".gitlab-ci.yml"), gitlabCi);

    const entries = await ciExtractor.extract({ projectPath: tempDir });

    // Only my_job's script should produce entries
    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe("testing");
  });

  it("returns [] for malformed YAML", async () => {
    await mkdir(join(tempDir, ".github", "workflows"), { recursive: true });
    await writeFile(
      join(tempDir, ".github", "workflows", "ci.yml"),
      "key: {unclosed bracket\n  - invalid"
    );

    const entries = await ciExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });

  it("returns [] when no CI files are found", async () => {
    const entries = await ciExtractor.extract({ projectPath: tempDir });
    expect(entries).toEqual([]);
  });

  it("entry metadata includes ciFile relative path", async () => {
    const workflow = `name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: bun run test
`;
    await mkdir(join(tempDir, ".github", "workflows"), { recursive: true });
    await writeFile(join(tempDir, ".github", "workflows", "main.yml"), workflow);

    const entries = await ciExtractor.extract({ projectPath: tempDir });

    expect(entries[0]!.metadata?.ciFile).toBe(".github/workflows/main.yml");
    expect(entries[0]!.evidence[0]!.file).toBe(".github/workflows/main.yml");
  });
});
