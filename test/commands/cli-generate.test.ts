import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

// ---------------------------------------------------------------------------
// Mocks (declared before imports so vi.mock hoisting works)
// ---------------------------------------------------------------------------

vi.mock("../../src/core/pipeline.js", () => ({
  extractConventions: vi.fn(),
}));

vi.mock("../../src/emitters/index.js", () => ({
  emit: vi.fn(),
}));

const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  text: "",
};

vi.mock("ora", () => ({
  default: vi.fn(() => mockSpinner),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { generateAction } from "../../src/commands/generate.js";
import { extractConventions } from "../../src/core/pipeline.js";
import { emit } from "../../src/emitters/index.js";
import { createRegistry, addConvention } from "../../src/core/registry.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTestRegistry() {
  let reg = createRegistry("/test/project");
  reg = {
    ...reg,
    stack: { language: "TypeScript", packageManager: "bun" },
  };
  reg = addConvention(reg, {
    category: "naming",
    pattern: "camelCase for variables",
    confidence: 0.9,
    evidence: [],
  });
  reg = addConvention(reg, {
    category: "testing",
    pattern: "test files in test/ directory",
    confidence: 0.85,
    evidence: [],
  });
  return reg;
}

function makeTestEmitResult(outputDir: string, dryRun: boolean) {
  const claudeMd = "# Project Context\n\nTest CLAUDE.md content";
  const agentsMd = "# AGENTS.md\n\nTest AGENTS.md content";
  return {
    rendered: { claude: claudeMd, agents: agentsMd },
    claudeMd,
    agentsMd,
    filesWritten: dryRun
      ? []
      : [
          path.join(outputDir, "CLAUDE.md"),
          path.join(outputDir, "AGENTS.md"),
        ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateAction", () => {
  const mockExtract = vi.mocked(extractConventions);
  const mockEmit = vi.mocked(emit);

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtract.mockResolvedValue(makeTestRegistry());
    mockEmit.mockImplementation(async (_reg, opts) =>
      makeTestEmitResult(opts.outputDir, opts.dryRun ?? false)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generate --dry-run does not write files", async () => {
    await generateAction(".", { dryRun: true, threshold: "0.7" });

    expect(mockEmit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ dryRun: true })
    );
    const result = await mockEmit.mock.results[0]?.value;
    expect(result?.filesWritten).toEqual([]);
  });

  it("generate writes files and prints paths (spinner.succeed called)", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await generateAction(".", { output: "/tmp/test-ez", threshold: "0.7" });

    expect(mockEmit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ dryRun: false })
    );
    expect(mockSpinner.succeed).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("generate resolves relative path to absolute before calling extractConventions", async () => {
    await generateAction("./foo", { threshold: "0.7" });

    expect(mockExtract).toHaveBeenCalledWith(
      expect.stringMatching(/^\/.*foo$/)
    );
    const receivedPath = mockExtract.mock.calls[0]?.[0];
    expect(path.isAbsolute(receivedPath ?? "")).toBe(true);
  });

  it("generate handles extraction errors: spinner.fail called and process exits with 1", async () => {
    mockExtract.mockRejectedValueOnce(new Error("analysis failed: disk error"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      generateAction(".", { threshold: "0.7" })
    ).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("generate rejects threshold of NaN (e.g. 'abc')", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      generateAction(".", { threshold: "abc" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("generate rejects negative threshold", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      generateAction(".", { threshold: "-1" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("generate rejects threshold greater than 1", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      generateAction(".", { threshold: "1.5" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("generate --dry-run shows dry-run content in output", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await generateAction(".", { dryRun: true, threshold: "0.7" });

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toMatch(/dry.run/i);

    consoleSpy.mockRestore();
  });
});
