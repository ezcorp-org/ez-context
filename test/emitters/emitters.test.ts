import { afterEach, describe, expect, it } from "vitest";
import { readFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { renderClaudeMd } from "../../src/emitters/claude-md.js";
import { renderAgentsMd } from "../../src/emitters/agents-md.js";
import { emit } from "../../src/emitters/index.js";
import { MARKER_START, MARKER_END } from "../../src/emitters/writer.js";
import { createRegistry, addConvention } from "../../src/core/registry.js";
import type { ConventionRegistry } from "../../src/core/schema.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeRegistry(): ConventionRegistry {
  let reg = createRegistry("/test/project");
  reg = {
    ...reg,
    stack: {
      language: "TypeScript",
      framework: "Express",
      testRunner: "Vitest",
      buildTool: "tsdown",
      packageManager: "bun",
    },
    architecture: {
      pattern: "layered",
      layers: ["core", "api", "db"],
    },
  };

  // High confidence conventions
  reg = addConvention(reg, {
    category: "naming",
    pattern: "camelCase for variables and functions",
    confidence: 0.9,
    evidence: [],
  });
  reg = addConvention(reg, {
    category: "imports",
    pattern: "use .js extension for relative imports",
    confidence: 0.8,
    evidence: [],
  });
  reg = addConvention(reg, {
    category: "testing",
    pattern: "test files in test/ directory matching *.test.ts",
    confidence: 0.85,
    evidence: [],
  });
  reg = addConvention(reg, {
    category: "stack",
    pattern: "build script",
    confidence: 0.95,
    evidence: [],
    metadata: { scriptName: "build", command: "tsdown" },
  });
  reg = addConvention(reg, {
    category: "stack",
    pattern: "test script",
    confidence: 0.95,
    evidence: [],
    metadata: { scriptName: "test", command: "vitest run" },
  });

  // Low confidence convention (below threshold)
  reg = addConvention(reg, {
    category: "naming",
    pattern: "snake_case for database columns",
    confidence: 0.5,
    evidence: [],
  });

  return reg;
}

// ---------------------------------------------------------------------------
// renderClaudeMd tests
// ---------------------------------------------------------------------------

describe("renderClaudeMd", () => {
  it("renders stack section with language, framework, and buildTool", () => {
    const reg = makeRegistry();
    const output = renderClaudeMd(reg, 0.7);

    expect(output).toContain("## Stack");
    expect(output).toContain("- Language: TypeScript");
    expect(output).toContain("- Framework: Express");
    expect(output).toContain("- Build: tsdown");
    expect(output).toContain("- Package Manager: bun");
    expect(output).toContain("- Test Runner: Vitest");
  });

  it("filters out conventions below the confidence threshold", () => {
    const reg = makeRegistry();
    const output = renderClaudeMd(reg, 0.7);

    // High confidence naming convention should appear
    expect(output).toContain("camelCase for variables and functions");
    // Low confidence (0.5) convention should NOT appear
    expect(output).not.toContain("snake_case for database columns");
  });

  it("omits Architecture section when no layers and no pattern", () => {
    let reg = createRegistry("/test");
    reg = { ...reg, stack: { language: "Go" } };
    // architecture defaults to { layers: [] }
    const output = renderClaudeMd(reg, 0.7);

    expect(output).not.toContain("## Architecture");
  });

  it("includes Architecture section when layers are present", () => {
    const reg = makeRegistry();
    const output = renderClaudeMd(reg, 0.7);

    expect(output).toContain("## Architecture");
    expect(output).toContain("- Pattern: layered");
    expect(output).toContain("- Layers: core, api, db");
  });

  it("includes high-confidence naming convention in output", () => {
    const reg = makeRegistry();
    const output = renderClaudeMd(reg, 0.7);

    expect(output).toContain("## Conventions");
    expect(output).toContain("**naming**: camelCase for variables and functions");
  });

  it("omits Conventions section when all conventions are below threshold", () => {
    let reg = createRegistry("/test");
    reg = { ...reg, stack: { language: "TypeScript" } };
    // Add only low-confidence conventions
    reg = addConvention(reg, {
      category: "naming",
      pattern: "some weak pattern",
      confidence: 0.3,
      evidence: [],
    });
    const output = renderClaudeMd(reg, 0.7);

    expect(output).not.toContain("## Conventions");
  });

  it("omits Stack section when language is unknown and no other stack info", () => {
    const reg = createRegistry("/test"); // defaults language: "unknown"
    const output = renderClaudeMd(reg, 0.7);

    expect(output).not.toContain("## Stack");
  });

  it("produces well-formatted markdown (no runon lines)", () => {
    const reg = makeRegistry();
    const output = renderClaudeMd(reg, 0.7);

    // Each bullet point should be on its own line
    const lines = output.split("\n");
    const bulletLines = lines.filter((l) => l.startsWith("-"));
    for (const line of bulletLines) {
      // Bullet lines should not start a new bullet mid-line
      expect(line).not.toMatch(/^-.*\n-/);
    }
  });
});

// ---------------------------------------------------------------------------
// renderAgentsMd tests
// ---------------------------------------------------------------------------

describe("renderAgentsMd", () => {
  it("renders Commands section with script conventions that have metadata.command", () => {
    const reg = makeRegistry();
    const output = renderAgentsMd(reg, 0.7);

    expect(output).toContain("## Commands");
    expect(output).toContain("`build`: `tsdown`");
    expect(output).toContain("`test`: `vitest run`");
  });

  it("renders Testing section when testRunner is set", () => {
    const reg = makeRegistry();
    const output = renderAgentsMd(reg, 0.7);

    expect(output).toContain("## Testing");
    expect(output).toContain("- Test runner: Vitest");
  });

  it("renders Testing section when testing conventions exist (no testRunner)", () => {
    let reg = createRegistry("/test");
    reg = { ...reg, stack: { language: "Python" } };
    reg = addConvention(reg, {
      category: "testing",
      pattern: "use pytest for all tests",
      confidence: 0.9,
      evidence: [],
    });
    const output = renderAgentsMd(reg, 0.7);

    expect(output).toContain("## Testing");
    expect(output).toContain("use pytest for all tests");
  });

  it("omits Code Style section when no naming or import conventions exist", () => {
    let reg = createRegistry("/test");
    reg = {
      ...reg,
      stack: { language: "Python", testRunner: "pytest" },
      architecture: { layers: [] },
    };
    const output = renderAgentsMd(reg, 0.7);

    expect(output).not.toContain("## Code Style");
  });

  it("renders Code Style section with naming and import conventions", () => {
    const reg = makeRegistry();
    const output = renderAgentsMd(reg, 0.7);

    expect(output).toContain("## Code Style");
    expect(output).toContain("**naming**: camelCase for variables and functions");
    expect(output).toContain("**imports**: use .js extension for relative imports");
  });

  it("always includes Boundaries section", () => {
    const reg = createRegistry("/test");
    const output = renderAgentsMd(reg, 0.7);

    expect(output).toContain("## Boundaries");
    expect(output).toContain("ez-context markers");
  });

  it("output is under 150 lines for a typical registry", () => {
    const reg = makeRegistry();
    const output = renderAgentsMd(reg, 0.7);
    const lineCount = output.split("\n").length;

    expect(lineCount).toBeLessThan(150);
  });

  it("omits Commands section when no conventions have command metadata", () => {
    let reg = createRegistry("/test");
    reg = addConvention(reg, {
      category: "naming",
      pattern: "camelCase",
      confidence: 0.9,
      evidence: [],
    });
    const output = renderAgentsMd(reg, 0.7);

    expect(output).not.toContain("## Commands");
  });

  it("does not duplicate 'Test runner:' when convention and stack both have it", () => {
    let reg = createRegistry("/test");
    reg = {
      ...reg,
      stack: { language: "TypeScript", testRunner: "Vitest" },
    };
    reg = addConvention(reg, {
      category: "testing",
      pattern: "Test runner: Vitest",
      confidence: 0.95,
      evidence: [],
      metadata: { testRunner: "Vitest" },
    });
    reg = addConvention(reg, {
      category: "testing",
      pattern: "test files in test/ directory",
      confidence: 0.85,
      evidence: [],
    });
    const output = renderAgentsMd(reg, 0.7);

    const matches = output.match(/Test runner: Vitest/g);
    expect(matches).toHaveLength(1);
    expect(output).toContain("test files in test/ directory");
  });
});

// ---------------------------------------------------------------------------
// emit() integration tests
// ---------------------------------------------------------------------------

describe("emit()", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
      }
    }
    tempDirs.length = 0;
  });

  function makeTmpDir(): string {
    const dir = path.join(os.tmpdir(), `ez-context-emit-test-${crypto.randomUUID()}`);
    tempDirs.push(dir);
    return dir;
  }

  it("returns rendered content without writing files in dryRun mode", async () => {
    const reg = makeRegistry();
    const result = await emit(reg, {
      outputDir: "/nonexistent",
      dryRun: true,
    });

    expect(result.claudeMd).toContain("# Project Context");
    expect(result.agentsMd).toContain("# AGENTS.md");
    expect(result.filesWritten).toEqual([]);
  });

  it("claudeMd contains stack info in dryRun mode", async () => {
    const reg = makeRegistry();
    const result = await emit(reg, { outputDir: "/nonexistent", dryRun: true });

    expect(result.claudeMd).toContain("TypeScript");
    expect(result.claudeMd).toContain("## Stack");
  });

  it("agentsMd contains AGENTS.md heading in dryRun mode", async () => {
    const reg = makeRegistry();
    const result = await emit(reg, { outputDir: "/nonexistent", dryRun: true });

    expect(result.agentsMd).toContain("# AGENTS.md");
    expect(result.agentsMd).toContain("## Boundaries");
  });

  it("writes CLAUDE.md and AGENTS.md files with marker pairs", async () => {
    const reg = makeRegistry();
    const tmpDir = makeTmpDir();
    await mkdir(tmpDir, { recursive: true });

    const result = await emit(reg, { outputDir: tmpDir, dryRun: false });

    const claudePath = path.join(tmpDir, "CLAUDE.md");
    const agentsPath = path.join(tmpDir, "AGENTS.md");

    expect(existsSync(claudePath)).toBe(true);
    expect(existsSync(agentsPath)).toBe(true);
    expect(result.filesWritten).toContain(claudePath);
    expect(result.filesWritten).toContain(agentsPath);

    const claudeContent = await readFile(claudePath, "utf-8");
    const agentsContent = await readFile(agentsPath, "utf-8");

    expect(claudeContent).toContain(MARKER_START);
    expect(claudeContent).toContain(MARKER_END);
    expect(agentsContent).toContain(MARKER_START);
    expect(agentsContent).toContain(MARKER_END);
  });

  it("markers wrap the generated content", async () => {
    const reg = makeRegistry();
    const tmpDir = makeTmpDir();
    await mkdir(tmpDir, { recursive: true });

    await emit(reg, { outputDir: tmpDir, dryRun: false });

    const claudeContent = await readFile(path.join(tmpDir, "CLAUDE.md"), "utf-8");

    const startIdx = claudeContent.indexOf(MARKER_START);
    const endIdx = claudeContent.indexOf(MARKER_END);
    const projectContextIdx = claudeContent.indexOf("# Project Context");

    expect(startIdx).toBeLessThan(projectContextIdx);
    expect(projectContextIdx).toBeLessThan(endIdx);
  });

  it("respects confidenceThreshold option", async () => {
    const reg = makeRegistry();
    const result = await emit(reg, {
      outputDir: "/nonexistent",
      dryRun: true,
      confidenceThreshold: 0.7,
    });

    // Low confidence convention (0.5) should not appear
    expect(result.claudeMd).not.toContain("snake_case for database columns");
    expect(result.agentsMd).not.toContain("snake_case for database columns");
  });

  it("filesWritten contains both paths when not dryRun", async () => {
    const reg = makeRegistry();
    const tmpDir = makeTmpDir();
    await mkdir(tmpDir, { recursive: true });

    const result = await emit(reg, { outputDir: tmpDir, dryRun: false });

    expect(result.filesWritten).toHaveLength(2);
    expect(result.filesWritten[0]).toMatch(/CLAUDE\.md$/);
    expect(result.filesWritten[1]).toMatch(/AGENTS\.md$/);
  });
});
