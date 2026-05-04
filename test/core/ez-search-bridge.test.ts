import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Module mocking — must be hoisted before the actual import
// ---------------------------------------------------------------------------

vi.mock("@ez-corp/ez-search", () => ({
  index: vi.fn().mockResolvedValue({ fileCount: 5, chunkCount: 42 }),
  query: vi.fn().mockResolvedValue({ code: [], text: [], image: [] }),
  status: vi.fn().mockResolvedValue({ fileCount: 5 }),
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
import { createBridge, isIndexCorrupt } from "../../src/core/ez-search-bridge.js";
import * as ezSearch from "@ez-corp/ez-search";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ez-context-bridge-test-"));
}

function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EzSearchBridge: hasIndex", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("returns false when .ez-search/ does not exist", async () => {
    const bridge = await createBridge(tempDir);
    expect(await bridge.hasIndex(tempDir)).toBe(false);
  });

  it("returns true when .ez-search/ exists", async () => {
    mkdirSync(join(tempDir, ".ez-search"));
    const bridge = await createBridge(tempDir);
    expect(await bridge.hasIndex(tempDir)).toBe(true);
  });
});

describe("EzSearchBridge: ensureIndex", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("calls index() when no .ez-search/ directory exists", async () => {
    const bridge = await createBridge(tempDir);
    await bridge.ensureIndex(tempDir);
    expect(ezSearch.index).toHaveBeenCalledWith(tempDir);
  });

  it("does NOT call index() when .ez-search/ already exists", async () => {
    mkdirSync(join(tempDir, ".ez-search"));
    const bridge = await createBridge(tempDir);
    await bridge.ensureIndex(tempDir);
    expect(ezSearch.index).not.toHaveBeenCalled();
  });
});

describe("EzSearchBridge: refreshIndex", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("calls index() incrementally even when .ez-search/ exists", async () => {
    mkdirSync(join(tempDir, ".ez-search"));
    const bridge = await createBridge(tempDir);
    await bridge.refreshIndex(tempDir);
    expect(ezSearch.index).toHaveBeenCalledWith(tempDir);
    expect(ezSearch.index).toHaveBeenCalledTimes(1);
  });

  it("calls index() when no .ez-search/ directory exists", async () => {
    const bridge = await createBridge(tempDir);
    await bridge.refreshIndex(tempDir);
    expect(ezSearch.index).toHaveBeenCalledWith(tempDir);
  });

  it("propagates errors from index()", async () => {
    vi.mocked(ezSearch.index).mockRejectedValueOnce(new Error("indexing failed"));
    const bridge = await createBridge(tempDir);
    await expect(bridge.refreshIndex(tempDir)).rejects.toThrow("indexing failed");
  });
});

describe("EzSearchBridge: search", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("returns empty array when no index exists (NO_INDEX error)", async () => {
    const { EzSearchError } = await import("@ez-corp/ez-search");
    vi.mocked(ezSearch.query).mockRejectedValueOnce(
      new EzSearchError("NO_INDEX", "No index found", "Run index first")
    );
    const bridge = await createBridge(tempDir);
    const results = await bridge.search("authentication logic");
    expect(results).toEqual([]);
  });

  it("maps code and text results to SearchResult shape", async () => {
    vi.mocked(ezSearch.query).mockResolvedValueOnce({
      code: [{ file: "src/auth.ts", text: "const token = ...", score: 0.9 }],
      text: [{ file: "docs/auth.md", text: "# Auth", score: 0.7 }],
      image: [],
    });
    const bridge = await createBridge(tempDir);
    const results = await bridge.search("auth", { k: 5 });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      file: "src/auth.ts",
      chunk: "const token = ...",
      score: 0.9,
    });
    expect(results[1]).toMatchObject({
      file: "docs/auth.md",
      chunk: "# Auth",
      score: 0.7,
    });
  });

  it("sorts results by score descending", async () => {
    vi.mocked(ezSearch.query).mockResolvedValueOnce({
      code: [{ file: "b.ts", text: "b", score: 0.5 }],
      text: [{ file: "a.md", text: "a", score: 0.9 }],
      image: [],
    });
    const bridge = await createBridge(tempDir);
    const results = await bridge.search("test");
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
  });
});

describe("EzSearchBridge: embed", () => {
  it("throws an informative error (not yet supported)", async () => {
    const bridge = await createBridge("/any/path");
    await expect(bridge.embed("hello")).rejects.toThrow("embed() is not yet supported");
  });
});

describe("createBridge", () => {
  it("returns an object implementing the EzSearchBridge interface", async () => {
    const bridge = await createBridge("/some/path");
    expect(typeof bridge.hasIndex).toBe("function");
    expect(typeof bridge.ensureIndex).toBe("function");
    expect(typeof bridge.refreshIndex).toBe("function");
    expect(typeof bridge.search).toBe("function");
    expect(typeof bridge.embed).toBe("function");
  });
});

describe("isIndexCorrupt", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("returns false when directory does not exist", () => {
    expect(isIndexCorrupt(join(tempDir, "nonexistent"))).toBe(false);
  });

  it("returns false for an empty directory", () => {
    const indexDir = join(tempDir, ".ez-search");
    mkdirSync(indexDir);
    expect(isIndexCorrupt(indexDir)).toBe(false);
  });

  it("returns false for a healthy index structure", () => {
    const indexDir = join(tempDir, ".ez-search");
    const segDir = join(indexDir, "col-768", "0");
    mkdirSync(segDir, { recursive: true });
    writeFileSync(join(segDir, "embedding.index.1.proxima"), "valid data");
    writeFileSync(join(segDir, "scalar.0.ipc"), "valid data");
    expect(isIndexCorrupt(indexDir)).toBe(false);
  });

  it("returns true when .proxima exists alongside zero-byte .ipc", () => {
    const indexDir = join(tempDir, ".ez-search");
    const segDir = join(indexDir, "col-768", "0");
    mkdirSync(segDir, { recursive: true });
    writeFileSync(join(segDir, "embedding.index.1.proxima"), "some data");
    writeFileSync(join(segDir, "scalar.0.ipc"), ""); // zero-byte
    expect(isIndexCorrupt(indexDir)).toBe(true);
  });

  it("ignores non-collection directories", () => {
    const indexDir = join(tempDir, ".ez-search");
    const nonCol = join(indexDir, "metadata", "0");
    mkdirSync(nonCol, { recursive: true });
    writeFileSync(join(nonCol, "embedding.index.1.proxima"), "data");
    writeFileSync(join(nonCol, "scalar.0.ipc"), ""); // zero-byte
    expect(isIndexCorrupt(indexDir)).toBe(false);
  });
});

describe("EzSearchBridge: refreshIndex recovery", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    vi.clearAllMocks();
  });

  afterEach(() => {
    removeTempDir(tempDir);
  });

  it("wipes corrupt index before calling index()", async () => {
    // Create a corrupt index structure
    const indexDir = join(tempDir, ".ez-search");
    const segDir = join(indexDir, "col-768", "0");
    mkdirSync(segDir, { recursive: true });
    writeFileSync(join(segDir, "embedding.index.1.proxima"), "data");
    writeFileSync(join(segDir, "scalar.0.ipc"), ""); // zero-byte = corrupt

    const bridge = await createBridge(tempDir);
    await bridge.refreshIndex(tempDir);

    // index() should have been called (after wipe)
    expect(ezSearch.index).toHaveBeenCalledWith(tempDir);
  });

  it("retries after wiping when index() throws a JS error", async () => {
    const indexDir = join(tempDir, ".ez-search");
    mkdirSync(indexDir);

    vi.mocked(ezSearch.index)
      .mockRejectedValueOnce(new Error("corrupt collection"))
      .mockResolvedValueOnce({ fileCount: 5, chunkCount: 42 });

    const bridge = await createBridge(tempDir);
    await bridge.refreshIndex(tempDir);

    // Called twice: first fails, wipe, second succeeds
    expect(ezSearch.index).toHaveBeenCalledTimes(2);
  });
});
