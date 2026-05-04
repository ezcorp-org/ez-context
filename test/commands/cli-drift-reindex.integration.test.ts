import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @ez-corp/ez-search — we can't run real ONNX in CI
// vi.mock factories are hoisted, so we use vi.hoisted() for shared refs
// ---------------------------------------------------------------------------

const { mockIndex, mockQuery } = vi.hoisted(() => ({
  mockIndex: vi.fn().mockResolvedValue({ fileCount: 1, chunkCount: 1 }),
  mockQuery: vi.fn().mockResolvedValue({ code: [], text: [], image: [] }),
}));

vi.mock("@ez-corp/ez-search", () => ({
  index: mockIndex,
  query: mockQuery,
  status: vi.fn().mockResolvedValue({ fileCount: 1 }),
  EzSearchError: class EzSearchError extends Error {
    constructor(
      public code: string,
      message: string,
      public hint?: string
    ) {
      super(message);
      this.name = "EzSearchError";
    }
  },
}));

// Import AFTER mock setup
import { createBridge } from "../../src/core/ez-search-bridge.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("refreshIndex integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls index() on every refreshIndex invocation", async () => {
    const bridge = await createBridge("/fake/project");

    await bridge.refreshIndex("/fake/project");
    expect(mockIndex).toHaveBeenCalledTimes(1);
    expect(mockIndex).toHaveBeenCalledWith("/fake/project");

    await bridge.refreshIndex("/fake/project");
    expect(mockIndex).toHaveBeenCalledTimes(2);
  });

  it("refreshIndex then search returns updated results", async () => {
    const bridge = await createBridge("/fake/project");

    // First search — no results
    mockQuery.mockResolvedValueOnce({ code: [], text: [], image: [] });
    const before = await bridge.search("new-function");
    expect(before).toHaveLength(0);

    // Simulate file changes + re-index
    await bridge.refreshIndex("/fake/project");
    expect(mockIndex).toHaveBeenCalledWith("/fake/project");

    // Second search — new content found
    mockQuery.mockResolvedValueOnce({
      code: [{ file: "src/new.ts", text: "function newFunction() {}", score: 0.95 }],
      text: [],
      image: [],
    });
    const after = await bridge.search("new-function");
    expect(after).toHaveLength(1);
    expect(after[0]!.file).toBe("src/new.ts");
  });
});
