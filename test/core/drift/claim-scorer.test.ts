import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  scoreClaims,
  GREEN_THRESHOLD,
  YELLOW_THRESHOLD,
  BATCH_SIZE,
  type ClaimStatus,
} from "../../../src/core/drift/claim-scorer.js";
import type { Claim } from "../../../src/core/drift/claim-extractor.js";
import type { EzSearchBridge, SearchResult } from "../../../src/core/ez-search-bridge.js";

// ---------------------------------------------------------------------------
// Mock bridge
// ---------------------------------------------------------------------------

const mockBridge: EzSearchBridge = {
  hasIndex: vi.fn(),
  ensureIndex: vi.fn(),
  search: vi.fn(),
  embed: vi.fn(),
  refreshIndex: vi.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClaim(text: string, line = 1): Claim {
  return { text, sourceFile: "test.md", sourceLine: line, sourceSection: "Test" };
}

function makeResult(score: number, n = 1): SearchResult[] {
  return Array.from({ length: n }, (_, i) => ({
    file: `src/file${i}.ts`,
    chunk: `code chunk ${i} for score ${score}`,
    score,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scoreClaims", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("classifies GREEN when top score >= 0.65", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(0.80));
    const [result] = await scoreClaims([makeClaim("uses TypeScript")], mockBridge);
    expect(result?.status).toBe("GREEN" satisfies ClaimStatus);
    expect(result?.score).toBe(0.80);
  });

  it("classifies GREEN at exactly the GREEN_THRESHOLD", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(GREEN_THRESHOLD));
    const [result] = await scoreClaims([makeClaim("uses bun")], mockBridge);
    expect(result?.status).toBe("GREEN");
  });

  it("classifies YELLOW when top score is between YELLOW and GREEN thresholds", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(0.50));
    const [result] = await scoreClaims([makeClaim("uses Express")], mockBridge);
    expect(result?.status).toBe("YELLOW" satisfies ClaimStatus);
    expect(result?.score).toBe(0.50);
  });

  it("classifies YELLOW at exactly the YELLOW_THRESHOLD", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(YELLOW_THRESHOLD));
    const [result] = await scoreClaims([makeClaim("uses Postgres")], mockBridge);
    expect(result?.status).toBe("YELLOW");
  });

  it("classifies RED when top score is below YELLOW threshold", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(0.20));
    const [result] = await scoreClaims([makeClaim("uses Redis")], mockBridge);
    expect(result?.status).toBe("RED" satisfies ClaimStatus);
    expect(result?.score).toBe(0.20);
  });

  it("classifies RED with score 0 when search returns no results", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue([]);
    const [result] = await scoreClaims([makeClaim("uses GraphQL")], mockBridge);
    expect(result?.status).toBe("RED");
    expect(result?.score).toBe(0);
  });

  it("calls bridge.search once per claim (25 claims = 25 calls)", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(0.70));
    const claims = Array.from({ length: 25 }, (_, i) => makeClaim(`claim ${i}`, i + 1));
    const results = await scoreClaims(claims, mockBridge);
    expect(mockBridge.search).toHaveBeenCalledTimes(25);
    expect(results).toHaveLength(25);
  });

  it("fires progress callback once per batch", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(0.70));
    const claims = Array.from({ length: 25 }, (_, i) => makeClaim(`claim ${i}`, i + 1));
    const onProgress = vi.fn();

    await scoreClaims(claims, mockBridge, onProgress);

    // 25 claims / 10 per batch = 3 batches (10, 10, 5)
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, 10, 25);
    expect(onProgress).toHaveBeenNthCalledWith(2, 20, 25);
    expect(onProgress).toHaveBeenNthCalledWith(3, 25, 25);
  });

  it("passes BATCH_SIZE=10 constant", () => {
    expect(BATCH_SIZE).toBe(10);
  });

  it("preserves all evidence results returned by bridge.search", async () => {
    const threeResults = makeResult(0.75, 3);
    vi.mocked(mockBridge.search).mockResolvedValue(threeResults);
    const [result] = await scoreClaims([makeClaim("uses vitest")], mockBridge);
    expect(result?.evidence).toHaveLength(3);
    expect(result?.evidence).toEqual(threeResults);
  });

  it("preserves claim reference on scored result", async () => {
    vi.mocked(mockBridge.search).mockResolvedValue(makeResult(0.80));
    const claim = makeClaim("handles authentication via JWT");
    const [result] = await scoreClaims([claim], mockBridge);
    expect(result?.claim).toBe(claim);
  });

  it("returns empty array for zero claims without calling bridge", async () => {
    const results = await scoreClaims([], mockBridge);
    expect(results).toEqual([]);
    expect(mockBridge.search).not.toHaveBeenCalled();
  });

  it("does not invoke progress callback when claims array is empty", async () => {
    const onProgress = vi.fn();
    await scoreClaims([], mockBridge, onProgress);
    expect(onProgress).not.toHaveBeenCalled();
  });
});
