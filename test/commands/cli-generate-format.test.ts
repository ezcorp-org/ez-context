import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

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

import { generateAction, parseFormats } from "../../src/commands/generate.js";
import { extractConventions } from "../../src/core/pipeline.js";
import { emit } from "../../src/emitters/index.js";
import { createRegistry } from "../../src/core/registry.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMinimalRegistry() {
  return createRegistry("/test/project");
}

function makeEmitResult(formats: string[], dryRun: boolean) {
  const rendered: Record<string, string> = {};
  for (const fmt of formats) {
    rendered[fmt] = `# ${fmt.toUpperCase()} content`;
  }
  return {
    rendered,
    claudeMd: rendered["claude"] ?? "",
    agentsMd: rendered["agents"] ?? "",
    filesWritten: dryRun ? [] : formats.map((f) => `/output/${f}.md`),
  };
}

// ---------------------------------------------------------------------------
// Tests: parseFormats (unit)
// ---------------------------------------------------------------------------

describe("parseFormats", () => {
  it("parses valid comma-separated formats", () => {
    expect(parseFormats("cursor,copilot")).toEqual(["cursor", "copilot"]);
  });

  it("throws on invalid format values", () => {
    expect(() => parseFormats("cursor,foobar")).toThrow(/foobar/);
    expect(() => parseFormats("cursor,foobar")).toThrow(/Valid:/);
  });

  it("deduplicates repeated format values", () => {
    expect(parseFormats("cursor,cursor,ruler")).toEqual(["cursor", "ruler"]);
  });

  it("trims whitespace around format values", () => {
    expect(parseFormats(" claude , agents ")).toEqual(["claude", "agents"]);
  });
});

// ---------------------------------------------------------------------------
// Tests: generateAction with --format flag
// ---------------------------------------------------------------------------

describe("generateAction --format", () => {
  const mockExtract = extractConventions as unknown as Mock;
  const mockEmit = emit as unknown as Mock;

  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtract.mockResolvedValue(makeMinimalRegistry());
    mockEmit.mockImplementation(async (_reg: unknown, opts: { formats?: string[]; dryRun?: boolean }) => {
      const formats = opts.formats ?? ["claude", "agents"];
      return makeEmitResult(formats, opts.dryRun ?? false);
    });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    errorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("passes formats:['cursor'] to emit when --format cursor is provided", async () => {
    await generateAction(".", { format: "cursor", dryRun: true, threshold: "0.7" });

    expect(mockEmit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ formats: ["cursor"] })
    );
  });

  it("passes default formats ['claude','agents'] when --format is not provided", async () => {
    await generateAction(".", { threshold: "0.7" });

    expect(mockEmit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ formats: ["claude", "agents"] })
    );
  });

  it("calls process.exit(1) and prints error for invalid --format value", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;

    await expect(
      generateAction(".", { format: "invalid-format", threshold: "0.7" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);
    const errorOutput = errorSpy.mock.calls.map((c: unknown[]) => String((c as unknown[])[0])).join("\n");
    expect(errorOutput).toMatch(/invalid-format/);
    expect(errorOutput).toMatch(/Valid:/);

    exitSpy.mockRestore();
  });
});
