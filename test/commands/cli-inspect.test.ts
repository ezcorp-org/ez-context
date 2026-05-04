import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (declared before imports so vi.mock hoisting works)
// ---------------------------------------------------------------------------

vi.mock("../../src/core/pipeline.js", () => ({
  extractConventions: vi.fn(),
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

import { inspectAction } from "../../src/commands/inspect.js";
import { extractConventions } from "../../src/core/pipeline.js";
import { createRegistry, addConvention } from "../../src/core/registry.js";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMultiCategoryRegistry() {
  let reg = createRegistry("/test/project");
  reg = {
    ...reg,
    stack: { language: "TypeScript", packageManager: "bun" },
  };
  // Stack convention
  reg = addConvention(reg, {
    category: "stack",
    pattern: "TypeScript project",
    confidence: 0.95,
    evidence: [],
  });
  // Naming convention (high confidence)
  reg = addConvention(reg, {
    category: "naming",
    pattern: "camelCase for variables",
    confidence: 0.9,
    evidence: [],
  });
  // Testing convention (high confidence)
  reg = addConvention(reg, {
    category: "testing",
    pattern: "vitest as test runner",
    confidence: 0.85,
    evidence: [],
  });
  // Low confidence convention
  reg = addConvention(reg, {
    category: "naming",
    pattern: "snake_case for database columns",
    confidence: 0.4,
    evidence: [],
  });
  return reg;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("inspectAction", () => {
  const mockExtract = vi.mocked(extractConventions);

  beforeEach(() => {
    vi.clearAllMocks();
    mockExtract.mockResolvedValue(makeMultiCategoryRegistry());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inspect displays conventions grouped by category", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await inspectAction(".", { threshold: "0.5" });

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");

    // Category headers should appear (uppercased)
    expect(output).toMatch(/NAMING/i);
    expect(output).toMatch(/TESTING/i);

    consoleSpy.mockRestore();
  });

  it("inspect filters conventions below the threshold", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await inspectAction(".", { threshold: "0.9" });

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");

    // High confidence (0.95, 0.9) should appear
    expect(output).toContain("camelCase for variables");

    // Low confidence (0.4 and 0.85) should NOT appear at threshold 0.9
    expect(output).not.toContain("snake_case for database columns");
    expect(output).not.toContain("vitest as test runner");

    consoleSpy.mockRestore();
  });

  it("inspect handles no conventions above threshold gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Set threshold very high so no conventions pass
    await inspectAction(".", { threshold: "0.99" });

    const output = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toMatch(/[Nn]o conventions/);

    consoleSpy.mockRestore();
  });

  it("inspect rejects threshold of NaN (e.g. 'abc')", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      inspectAction(".", { threshold: "abc" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("inspect rejects negative threshold", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      inspectAction(".", { threshold: "-1" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("inspect rejects threshold greater than 1", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      inspectAction(".", { threshold: "1.5" })
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("inspect handles extraction errors: spinner.fail called and process exits with 1", async () => {
    mockExtract.mockRejectedValueOnce(new Error("extraction failed"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((_code?: number | string | null | undefined) => {
        throw new Error("process.exit called");
      }) as unknown as ReturnType<typeof vi.spyOn>;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      inspectAction(".", { threshold: "0.7" })
    ).rejects.toThrow("process.exit called");

    expect(mockSpinner.fail).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
