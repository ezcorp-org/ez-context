import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (declared before imports so vi.mock hoisting works)
// ---------------------------------------------------------------------------

vi.mock("../../src/emitters/writer.js", () => ({
  MARKER_START: "<!-- ez-context:start -->",
  MARKER_END: "<!-- ez-context:end -->",
  writeWithMarkers: vi.fn(),
}));

vi.mock("../../src/emitters/claude-md.js", () => ({
  renderClaudeMd: vi.fn(),
}));

vi.mock("../../src/emitters/agents-md.js", () => ({
  renderAgentsMd: vi.fn(),
}));

vi.mock("../../src/emitters/copilot-md.js", () => ({
  renderCopilotMd: vi.fn(),
}));

vi.mock("../../src/emitters/cursor-mdc.js", () => ({
  renderCursorMdc: vi.fn(),
}));

vi.mock("../../src/core/drift/claim-extractor.js", () => ({
  extractClaims: vi.fn(),
}));

vi.mock("../../src/core/drift/claim-scorer.js", () => ({
  scoreClaims: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  copyFile: vi.fn(),
  writeFile: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { validateMarkers, backupFile, updateFile } from "../../src/core/updater.js";
import { MARKER_START, MARKER_END, writeWithMarkers } from "../../src/emitters/writer.js";
import { renderClaudeMd } from "../../src/emitters/claude-md.js";
import { renderAgentsMd } from "../../src/emitters/agents-md.js";
import { renderCopilotMd } from "../../src/emitters/copilot-md.js";
import { renderCursorMdc } from "../../src/emitters/cursor-mdc.js";
import { extractClaims } from "../../src/core/drift/claim-extractor.js";
import { scoreClaims } from "../../src/core/drift/claim-scorer.js";
import { existsSync } from "node:fs";
import { readFile, copyFile, writeFile } from "node:fs/promises";
import type { ConventionRegistry } from "../../src/core/schema.js";
import type { EzSearchBridge } from "../../src/core/ez-search-bridge.js";

// ---------------------------------------------------------------------------
// Typed mock helpers
// Each imported vi.mock'd function is cast to Mock for typed access.
// vi.mocked() is not reliably available in bun's vitest integration.
// ---------------------------------------------------------------------------

const mockExistsSync = existsSync as unknown as Mock;
const mockReadFile = readFile as unknown as Mock;
const mockCopyFile = copyFile as unknown as Mock;
const mockWriteFile = writeFile as unknown as Mock;
const mockExtractClaims = extractClaims as unknown as Mock;
const mockScoreClaims = scoreClaims as unknown as Mock;
const mockWriteWithMarkers = writeWithMarkers as unknown as Mock;
const mockRenderClaudeMd = renderClaudeMd as unknown as Mock;
const mockRenderAgentsMd = renderAgentsMd as unknown as Mock;
const mockRenderCopilotMd = renderCopilotMd as unknown as Mock;
const mockRenderCursorMdc = renderCursorMdc as unknown as Mock;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMockBridge(): EzSearchBridge {
  return {
    hasIndex: vi.fn().mockResolvedValue(true),
    ensureIndex: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    embed: vi.fn().mockRejectedValue(new Error("not supported")),
    refreshIndex: vi.fn().mockResolvedValue(undefined),
  };
}

function makeRegistry(): ConventionRegistry {
  return {
    version: "1",
    projectPath: "/project",
    generatedAt: new Date().toISOString(),
    stack: { language: "TypeScript" },
    conventions: [],
    architecture: { layers: [] },
  };
}

function makeScoredClaim(status: "GREEN" | "YELLOW" | "RED") {
  return {
    claim: {
      text: "Some claim text",
      sourceFile: "/project/CLAUDE.md",
      sourceLine: 1,
      sourceSection: "Context",
    },
    status,
    score: status === "GREEN" ? 0.8 : status === "YELLOW" ? 0.5 : 0.2,
    evidence: [],
  };
}

// Content helpers using the (mocked) marker constants
const contentWithBothMarkers = `# Context\n\n${MARKER_START}\nsome content\n${MARKER_END}\n`;
const contentWithOnlyStart = `# Context\n\n${MARKER_START}\nsome content\n`;
const contentWithOnlyEnd = `# Context\n\nsome content\n${MARKER_END}\n`;
const contentWithInvertedMarkers = `# Context\n\n${MARKER_END}\nsome content\n${MARKER_START}\n`;
const contentWithNoMarkers = `# Context\n\n- some content\n`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ============================================================
// validateMarkers — pure function, no mocks needed
// ============================================================

describe("validateMarkers", () => {
  it("returns mode 'append' when content has no markers", () => {
    const result = validateMarkers(contentWithNoMarkers);
    expect(result).toEqual({ valid: true, mode: "append" });
  });

  it("returns mode 'splice' with correct indices when both markers present in order", () => {
    const result = validateMarkers(contentWithBothMarkers);
    expect(result.valid).toBe(true);
    expect(result.mode).toBe("splice");
    expect(typeof result.startIdx).toBe("number");
    expect(typeof result.endIdx).toBe("number");
    expect(result.startIdx!).toBeLessThan(result.endIdx!);
  });

  it("returns mode 'invalid' when only start marker present", () => {
    const result = validateMarkers(contentWithOnlyStart);
    expect(result.valid).toBe(false);
    expect(result.mode).toBe("invalid");
    expect(result.reason).toMatch(/end marker missing/i);
  });

  it("returns mode 'invalid' when only end marker present", () => {
    const result = validateMarkers(contentWithOnlyEnd);
    expect(result.valid).toBe(false);
    expect(result.mode).toBe("invalid");
    expect(result.reason).toMatch(/start marker missing/i);
  });

  it("returns mode 'invalid' when end marker appears before start marker", () => {
    const result = validateMarkers(contentWithInvertedMarkers);
    expect(result.valid).toBe(false);
    expect(result.mode).toBe("invalid");
    expect(result.reason).toMatch(/end marker appears before start marker/i);
  });
});

// ============================================================
// backupFile
// ============================================================

describe("backupFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await backupFile("/project/CLAUDE.md");

    expect(result).toBeNull();
    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  it("copies file to .bak path and returns the backup path", async () => {
    mockExistsSync.mockReturnValue(true);
    mockCopyFile.mockResolvedValue(undefined);

    const result = await backupFile("/project/CLAUDE.md");

    expect(result).toBe("/project/CLAUDE.md.bak");
    expect(mockCopyFile).toHaveBeenCalledWith(
      "/project/CLAUDE.md",
      "/project/CLAUDE.md.bak"
    );
  });
});

// ============================================================
// updateFile
// ============================================================

describe("updateFile", () => {
  const filePath = "/project/CLAUDE.md";
  let bridge: EzSearchBridge;
  let registry: ConventionRegistry;

  beforeEach(() => {
    vi.clearAllMocks();

    bridge = makeMockBridge();
    registry = makeRegistry();

    // Default happy path: file exists, has markers, has drift
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(contentWithBothMarkers);
    mockCopyFile.mockResolvedValue(undefined);
    mockExtractClaims.mockReturnValue([
      { text: "Some claim text", sourceFile: filePath, sourceLine: 2, sourceSection: "Context" },
    ]);
    mockScoreClaims.mockResolvedValue([makeScoredClaim("YELLOW")]);
    mockRenderClaudeMd.mockReturnValue("# Rendered content\n");
    mockRenderAgentsMd.mockReturnValue("# AGENTS.md rendered\n");
    mockWriteWithMarkers.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 8. Skips when file does not exist
  it("skips when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await updateFile(filePath, registry, bridge);

    expect(result.action).toBe("skipped");
    expect(result.reason).toMatch(/does not exist/i);
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(mockWriteWithMarkers).not.toHaveBeenCalled();
  });

  // 9. Aborts when markers are invalid
  it("aborts when markers are invalid (only start marker present)", async () => {
    mockReadFile.mockResolvedValue(contentWithOnlyStart);

    const result = await updateFile(filePath, registry, bridge);

    expect(result.action).toBe("aborted");
    expect(result.reason).toMatch(/end marker missing/i);
    expect(mockCopyFile).not.toHaveBeenCalled();
    expect(mockWriteWithMarkers).not.toHaveBeenCalled();
  });

  // 10. Skips when no drift detected (all GREEN)
  it("skips when no drift detected (all claims GREEN)", async () => {
    mockScoreClaims.mockResolvedValue([makeScoredClaim("GREEN")]);

    const result = await updateFile(filePath, registry, bridge);

    expect(result.action).toBe("skipped");
    expect(result.reason).toBe("No drift detected");
    expect(mockCopyFile).not.toHaveBeenCalled();
    expect(mockWriteWithMarkers).not.toHaveBeenCalled();
  });

  // 11. Updates and creates backup when drift detected
  it("updates and creates backup when drift detected", async () => {
    mockScoreClaims.mockResolvedValue([makeScoredClaim("YELLOW")]);

    const result = await updateFile(filePath, registry, bridge);

    expect(result.action).toBe("updated");
    expect(result.reason).toBe("Re-rendered drifted sections");
    expect(result.backupPath).toBe(filePath + ".bak");
    expect(mockCopyFile).toHaveBeenCalledWith(filePath, filePath + ".bak");
    expect(mockWriteWithMarkers).toHaveBeenCalled();
  });

  // 12a. Calls renderAgentsMd for AGENTS.md files
  it("calls renderAgentsMd for AGENTS.md files", async () => {
    const agentsPath = "/project/AGENTS.md";
    mockExtractClaims.mockReturnValue([
      { text: "Some claim text", sourceFile: agentsPath, sourceLine: 2, sourceSection: "Testing" },
    ]);

    await updateFile(agentsPath, registry, bridge);

    expect(mockRenderAgentsMd).toHaveBeenCalled();
    expect(mockRenderClaudeMd).not.toHaveBeenCalled();
  });

  // 12b. Calls renderClaudeMd for non-AGENTS.md files
  it("calls renderClaudeMd for non-AGENTS.md files", async () => {
    await updateFile(filePath, registry, bridge);

    expect(mockRenderClaudeMd).toHaveBeenCalled();
    expect(mockRenderAgentsMd).not.toHaveBeenCalled();
  });

  // 13. Calls writeWithMarkers with the rendered content
  it("calls writeWithMarkers with rendered content", async () => {
    const rendered = "# Rendered content\n";
    mockRenderClaudeMd.mockReturnValue(rendered);

    await updateFile(filePath, registry, bridge);

    expect(mockWriteWithMarkers).toHaveBeenCalledWith(filePath, rendered);
  });

  // 14. Does NOT create backup when skipping
  it("does not create backup when skipping (all GREEN)", async () => {
    mockScoreClaims.mockResolvedValue([makeScoredClaim("GREEN")]);

    await updateFile(filePath, registry, bridge);

    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  // 15. Does NOT create backup when aborting
  it("does not create backup when aborting (invalid markers)", async () => {
    mockReadFile.mockResolvedValue(contentWithOnlyEnd);

    await updateFile(filePath, registry, bridge);

    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  // 16a. Passes confidenceThreshold to renderClaudeMd
  it("passes confidenceThreshold to renderClaudeMd", async () => {
    const threshold = 0.85;

    await updateFile(filePath, registry, bridge, threshold);

    expect(mockRenderClaudeMd).toHaveBeenCalledWith(registry, threshold);
  });

  // 16b. Passes confidenceThreshold to renderAgentsMd
  it("passes confidenceThreshold to renderAgentsMd", async () => {
    const agentsPath = "/project/AGENTS.md";
    mockExtractClaims.mockReturnValue([
      { text: "Some claim text", sourceFile: agentsPath, sourceLine: 2, sourceSection: "Testing" },
    ]);
    const threshold = 0.9;

    await updateFile(agentsPath, registry, bridge, threshold);

    expect(mockRenderAgentsMd).toHaveBeenCalledWith(registry, threshold);
  });

  // Bonus: append mode (no markers) always proceeds without drift check
  it("updates file in append mode (no markers) without drift check", async () => {
    mockReadFile.mockResolvedValue(contentWithNoMarkers);

    const result = await updateFile(filePath, registry, bridge);

    expect(result.action).toBe("updated");
    // scoreClaims should NOT be called -- append mode has no existing section to check
    expect(mockScoreClaims).not.toHaveBeenCalled();
    expect(mockWriteWithMarkers).toHaveBeenCalled();
  });

  // New: copilot file uses markers strategy
  it("calls renderCopilotMd and writeWithMarkers for a copilot file", async () => {
    const copilotPath = "/project/.github/copilot-instructions.md";
    mockExtractClaims.mockReturnValue([
      { text: "Some claim text", sourceFile: copilotPath, sourceLine: 2, sourceSection: "Stack" },
    ]);
    const rendered = "# Copilot Instructions\n";
    mockRenderCopilotMd.mockReturnValue(rendered);

    const result = await updateFile(copilotPath, registry, bridge);

    expect(result.action).toBe("updated");
    expect(mockRenderCopilotMd).toHaveBeenCalledWith(registry, 0.7);
    expect(mockWriteWithMarkers).toHaveBeenCalledWith(copilotPath, rendered);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  // New: cursor file uses direct strategy (full overwrite, no drift check)
  it("calls renderCursorMdc and writeFile for a cursor file (direct strategy)", async () => {
    const cursorPath = "/project/.cursor/rules/ez-context.mdc";
    const rendered = "# Cursor Rules\n";
    mockRenderCursorMdc.mockReturnValue(rendered);
    mockWriteFile.mockResolvedValue(undefined);

    const result = await updateFile(cursorPath, registry, bridge);

    expect(result.action).toBe("updated");
    expect(result.reason).toMatch(/direct strategy/i);
    expect(mockRenderCursorMdc).toHaveBeenCalledWith(registry, 0.7);
    expect(mockWriteFile).toHaveBeenCalledWith(cursorPath, rendered, "utf-8");
    // Direct strategy should NOT perform drift detection
    expect(mockExtractClaims).not.toHaveBeenCalled();
    expect(mockScoreClaims).not.toHaveBeenCalled();
    // Direct strategy should NOT use writeWithMarkers
    expect(mockWriteWithMarkers).not.toHaveBeenCalled();
    // Direct strategy should still create a backup
    expect(mockCopyFile).toHaveBeenCalledWith(cursorPath, cursorPath + ".bak");
  });
});
