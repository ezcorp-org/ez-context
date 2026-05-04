import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import type { Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (declared before imports so vi.mock hoisting works)
// ---------------------------------------------------------------------------

vi.mock("../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn(),
}));

vi.mock("../../src/core/updater.js", () => ({
  updateFile: vi.fn(),
}));

vi.mock("../../src/core/pipeline.js", () => ({
  extractConventions: vi.fn(),
}));

vi.mock("../../src/core/drift/claim-extractor.js", () => ({
  extractClaims: vi.fn(),
}));

vi.mock("../../src/core/drift/claim-scorer.js", () => ({
  scoreClaims: vi.fn(),
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

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

// Mock dynamic import of node:fs/promises used in dry-run path
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { updateAction } from "../../src/commands/update.js";
import { createBridge } from "../../src/core/ez-search-bridge.js";
import { updateFile } from "../../src/core/updater.js";
import { extractConventions } from "../../src/core/pipeline.js";
import { extractClaims } from "../../src/core/drift/claim-extractor.js";
import { scoreClaims } from "../../src/core/drift/claim-scorer.js";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

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

function makeMinimalRegistry() {
  return { conventions: [], stack: {}, architecture: { layers: [] } };
}

function makeUpdateResult(
  filePath: string,
  action: "updated" | "skipped" | "aborted" = "updated"
) {
  return {
    filePath,
    action,
    reason: action === "updated" ? "Re-rendered drifted sections" : action === "skipped" ? "No drift detected" : "Unpaired marker",
    backupPath: action === "updated" ? filePath + ".bak" : undefined,
  };
}

function makeScoredClaim(text: string, status: "GREEN" | "YELLOW" | "RED" = "YELLOW") {
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

describe("updateAction", () => {
  const mockCreateBridge = createBridge as unknown as Mock;
  const mockUpdateFile = updateFile as unknown as Mock;
  const mockExtractConventions = extractConventions as unknown as Mock;
  const mockExtractClaims = extractClaims as unknown as Mock;
  const mockScoreClaims = scoreClaims as unknown as Mock;
  const mockExistsSync = existsSync as unknown as Mock;
  const mockReadFile = readFile as unknown as Mock;

  const projectPath = path.resolve(".");
  const claudeMdPath = path.join(projectPath, "CLAUDE.md");
  const agentsMdPath = path.join(projectPath, "AGENTS.md");

  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: bridge with refreshIndex, CLAUDE.md exists, AGENTS.md does not
    mockCreateBridge.mockResolvedValue(makeMockBridge());
    mockExistsSync.mockImplementation((p: unknown) => String(p) === claudeMdPath);
    mockExtractConventions.mockResolvedValue(makeMinimalRegistry());
    mockUpdateFile.mockResolvedValue(makeUpdateResult(claudeMdPath, "updated"));
    mockExtractClaims.mockReturnValue([
      { text: "Uses TypeScript", sourceFile: claudeMdPath, sourceLine: 1, sourceSection: "Stack" },
    ]);
    mockScoreClaims.mockResolvedValue([makeScoredClaim("Uses TypeScript", "YELLOW")]);

    mockReadFile.mockResolvedValue("# CLAUDE.md\nSome content here");

    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Always refreshes index
  // -------------------------------------------------------------------------

  it("always calls refreshIndex before processing", async () => {
    await updateAction(".", {});

    const bridge = await mockCreateBridge.mock.results[0]!.value;
    expect(bridge.refreshIndex).toHaveBeenCalledWith(projectPath);
  });

  it("handles refreshIndex error gracefully", async () => {
    const bridge = makeMockBridge();
    bridge.refreshIndex.mockRejectedValueOnce(new Error("indexing failed"));
    mockCreateBridge.mockResolvedValue(bridge);

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;

    await expect(updateAction(".", {})).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalledWith("Update failed");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("indexing failed"));

    exitSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 2. No files found -> exits with error
  // -------------------------------------------------------------------------

  it("exits with error when no context files found", async () => {
    mockExistsSync.mockReturnValue(false);

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;

    await expect(updateAction(".", {})).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalledWith("No context files found");
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 3. Calls updateFile for each detected file
  // -------------------------------------------------------------------------

  it("calls updateFile for each detected file", async () => {
    await updateAction(".", {});

    expect(mockUpdateFile).toHaveBeenCalledWith(
      claudeMdPath,
      makeMinimalRegistry(),
      expect.any(Object)
    );
  });

  // -------------------------------------------------------------------------
  // 4. Reports "all up to date" when all files skipped
  // -------------------------------------------------------------------------

  it("reports 'all up to date' when all files skipped", async () => {
    mockUpdateFile.mockResolvedValue(makeUpdateResult(claudeMdPath, "skipped"));

    await updateAction(".", {});

    const succeedCalls = mockSpinner.succeed.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(succeedCalls.some((msg) => msg.includes("up to date"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 5. Reports updated files with backup path
  // -------------------------------------------------------------------------

  it("reports updated files with backup path", async () => {
    await updateAction(".", {});

    const logCalls = consoleSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const output = logCalls.join("\n");
    expect(output).toContain("CLAUDE.md");
  });

  // -------------------------------------------------------------------------
  // 6. Reports aborted files with warning
  // -------------------------------------------------------------------------

  it("reports aborted files with warning", async () => {
    mockUpdateFile.mockResolvedValue(makeUpdateResult(claudeMdPath, "aborted"));

    await updateAction(".", {});

    const logCalls = consoleSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(logCalls).toContain("Unpaired marker");
  });

  // -------------------------------------------------------------------------
  // 7. extractConventions called once even with multiple files
  // -------------------------------------------------------------------------

  it("calls extractConventions once even with multiple files", async () => {
    // Both CLAUDE.md and AGENTS.md exist
    mockExistsSync.mockReturnValue(true);
    mockUpdateFile
      .mockResolvedValueOnce(makeUpdateResult(claudeMdPath, "updated"))
      .mockResolvedValueOnce(makeUpdateResult(agentsMdPath, "updated"));

    await updateAction(".", {});

    expect(mockExtractConventions).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // 8. Handles --file option
  // -------------------------------------------------------------------------

  it("handles --file option by updating only the specified file", async () => {
    const customFile = "/custom/MY.md";
    mockUpdateFile.mockResolvedValue(makeUpdateResult(customFile, "updated"));

    await updateAction(".", { file: customFile });

    expect(mockUpdateFile).toHaveBeenCalledTimes(1);
    expect(mockUpdateFile).toHaveBeenCalledWith(
      path.resolve(projectPath, customFile),
      expect.any(Object),
      expect.any(Object)
    );
  });

  // -------------------------------------------------------------------------
  // 9. Handles errors gracefully
  // -------------------------------------------------------------------------

  it("handles errors gracefully when createBridge throws", async () => {
    mockCreateBridge.mockRejectedValueOnce(new Error("bridge init failed"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;

    await expect(updateAction(".", {})).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalledWith("Update failed");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("bridge init failed"));

    exitSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // 10. Dry-run: shows "Would update" for files with drift
  // -------------------------------------------------------------------------

  it("dry-run shows would-update for drifted files", async () => {
    // scoreClaims returns YELLOW by default (set in beforeEach)
    await updateAction(".", { dryRun: true });

    expect(mockUpdateFile).not.toHaveBeenCalled();
    expect(mockExtractConventions).not.toHaveBeenCalled();

    const logCalls = consoleSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(logCalls).toContain("Would update");
  });

  // -------------------------------------------------------------------------
  // 11. Dry-run: shows "Up to date" for files with no drift
  // -------------------------------------------------------------------------

  it("dry-run shows up-to-date for non-drifted files", async () => {
    mockScoreClaims.mockResolvedValue([makeScoredClaim("Uses TypeScript", "GREEN")]);

    await updateAction(".", { dryRun: true });

    expect(mockUpdateFile).not.toHaveBeenCalled();

    const logCalls = consoleSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(logCalls).toContain("Up to date");
  });
});
