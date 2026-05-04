import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";


// ---------------------------------------------------------------------------
// Mocks (declared before imports so vi.mock hoisting works)
// ---------------------------------------------------------------------------

vi.mock("../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn(),
}));

vi.mock("../../src/core/drift/claim-extractor.js", () => ({
  extractClaims: vi.fn(),
}));

vi.mock("../../src/core/drift/claim-scorer.js", () => ({
  scoreClaims: vi.fn(),
}));

vi.mock("../../src/core/drift/report.js", () => ({
  buildDriftReport: vi.fn(),
  renderDriftReport: vi.fn(),
  computeHealthScore: vi.fn(),
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

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { driftAction } from "../../src/commands/drift.js";
import { createBridge } from "../../src/core/ez-search-bridge.js";
import { extractClaims } from "../../src/core/drift/claim-extractor.js";
import { scoreClaims } from "../../src/core/drift/claim-scorer.js";
import { buildDriftReport, renderDriftReport, computeHealthScore } from "../../src/core/drift/report.js";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMockBridge() {
  return {
    hasIndex: vi.fn().mockResolvedValue(true),
    ensureIndex: vi.fn().mockResolvedValue(undefined),
    refreshIndex: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    embed: vi.fn().mockRejectedValue(new Error("not supported")),
  };
}

function makeScoredClaim(text: string, status: "GREEN" | "YELLOW" | "RED" = "GREEN") {
  return {
    claim: { text, sourceFile: "/project/CLAUDE.md", sourceLine: 1, sourceSection: "Setup" },
    status,
    score: status === "GREEN" ? 0.8 : status === "YELLOW" ? 0.5 : 0.2,
    evidence: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("driftAction", () => {
  const mockCreateBridge = vi.mocked(createBridge);
  const mockExtractClaims = vi.mocked(extractClaims);
  const mockScoreClaims = vi.mocked(scoreClaims);
  const mockBuildDriftReport = vi.mocked(buildDriftReport);
  const mockRenderDriftReport = vi.mocked(renderDriftReport);
  const mockComputeHealthScore = vi.mocked(computeHealthScore);
  const mockReadFile = vi.mocked(readFile);
  const mockExistsSync = vi.mocked(existsSync);

  beforeEach(() => {
    vi.clearAllMocks();

    // Defaults: happy path
    const bridge = makeMockBridge();
    mockCreateBridge.mockResolvedValue(bridge);
    mockExistsSync.mockReturnValue(false);
    mockReadFile.mockResolvedValue("# Context\n- Uses TypeScript" as never);
    mockExtractClaims.mockReturnValue([
      { text: "Uses TypeScript", sourceFile: "/project/CLAUDE.md", sourceLine: 2, sourceSection: "Context" },
    ]);
    mockScoreClaims.mockResolvedValue([makeScoredClaim("Uses TypeScript")]);
    mockBuildDriftReport.mockReturnValue({
      sourceFile: "/project/CLAUDE.md",
      healthScore: 80,
      scoredClaims: [makeScoredClaim("Uses TypeScript")],
    });
    mockRenderDriftReport.mockReturnValue("# Drift Report\n\nHealth Score: 80/100");
    mockComputeHealthScore.mockReturnValue(80);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. refreshIndex is always called
  // -------------------------------------------------------------------------

  it("always calls refreshIndex before analysing", async () => {
    const bridge = makeMockBridge();
    mockCreateBridge.mockResolvedValue(bridge);
    mockExistsSync.mockImplementation((p) => String(p).endsWith("CLAUDE.md"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await driftAction(".", {});

    expect(bridge.refreshIndex).toHaveBeenCalledWith(path.resolve("."));
    consoleSpy.mockRestore();
  });

  it("shows 'Refreshing search index...' spinner text", async () => {
    const bridge = makeMockBridge();
    mockCreateBridge.mockResolvedValue(bridge);
    mockExistsSync.mockImplementation((p) => String(p).endsWith("CLAUDE.md"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const textValues: string[] = [];
    Object.defineProperty(mockSpinner, "text", {
      set(val: string) { textValues.push(val); },
      get() { return textValues[textValues.length - 1] ?? ""; },
      configurable: true,
    });

    await driftAction(".", {});

    expect(textValues).toContain("Refreshing search index...");
    expect(textValues).toContain("Loading context files...");

    // Restore text to plain property
    Object.defineProperty(mockSpinner, "text", { value: "", writable: true, configurable: true });
    consoleSpy.mockRestore();
  });

  it("fails when refreshIndex throws", async () => {
    const bridge = makeMockBridge();
    bridge.refreshIndex.mockRejectedValueOnce(new Error("indexing failed"));
    mockCreateBridge.mockResolvedValue(bridge);

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(driftAction(".", {})).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalledWith("Drift analysis failed");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("indexing failed"));

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 2. No files found -> exits with error
  // -------------------------------------------------------------------------

  it("exits with error when no context files are found", async () => {
    // existsSync returns false for all candidates (default in beforeEach)
    mockExistsSync.mockReturnValue(false);

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(driftAction(".", {})).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalledWith("No context files found");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 3. --file option: uses specified file path
  // -------------------------------------------------------------------------

  it("uses specified --file path and calls extractClaims with its content", async () => {
    const fileContent = "# My Context\n- Implements REST API";
    mockReadFile.mockResolvedValue(fileContent as never);
    mockExtractClaims.mockReturnValue([
      { text: "Implements REST API", sourceFile: "/custom/MYCONTEXT.md", sourceLine: 2, sourceSection: "My Context" },
    ]);
    mockScoreClaims.mockResolvedValue([makeScoredClaim("Implements REST API")]);
    mockBuildDriftReport.mockReturnValue({
      sourceFile: "/custom/MYCONTEXT.md",
      healthScore: 75,
      scoredClaims: [makeScoredClaim("Implements REST API")],
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const projectPath = path.resolve(".");
    await driftAction(".", { file: "/custom/MYCONTEXT.md" });

    // readFile called with the specified file resolved relative to projectPath
    expect(mockReadFile).toHaveBeenCalledWith(
      path.resolve(projectPath, "/custom/MYCONTEXT.md"),
      "utf-8"
    );
    expect(mockExtractClaims).toHaveBeenCalledWith(fileContent, path.resolve(projectPath, "/custom/MYCONTEXT.md"));

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 4. Auto-detect: CLAUDE.md only
  // -------------------------------------------------------------------------

  it("auto-detects and reads CLAUDE.md when only it exists", async () => {
    const claudeMdPath = path.join(path.resolve("."), "CLAUDE.md");
    mockExistsSync.mockImplementation((p) => p === claudeMdPath);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await driftAction(".", {});

    expect(mockReadFile).toHaveBeenCalledWith(claudeMdPath, "utf-8");

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 5. Full flow: renderDriftReport output logged to console
  // -------------------------------------------------------------------------

  it("prints renderDriftReport result to console on full flow", async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith("CLAUDE.md"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await driftAction(".", {});

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("# Drift Report");
    expect(mockRenderDriftReport).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 6. Progress callback wired: scoreClaims receives onProgress function
  // -------------------------------------------------------------------------

  it("passes an onProgress function as third argument to scoreClaims", async () => {
    mockExistsSync.mockImplementation((p) => String(p).endsWith("CLAUDE.md"));
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await driftAction(".", {});

    expect(mockScoreClaims).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      expect.any(Function)
    );

    consoleSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 7. Error handling: createBridge throws -> spinner.fail + process.exit(1)
  // -------------------------------------------------------------------------

  it("handles createBridge error: spinner.fail called and process exits with 1", async () => {
    mockCreateBridge.mockRejectedValueOnce(new Error("bridge init failed"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(driftAction(".", {})).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalledWith("Drift analysis failed");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("bridge init failed"));

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
