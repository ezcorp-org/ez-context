import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolve } from "node:path";
import { ConventionRegistrySchema } from "../../src/core/schema.js";

// ---------------------------------------------------------------------------
// Module-level mocks for semantic extractor integration tests.
// vi.mock is hoisted; factories must NOT reference external variables.
// ---------------------------------------------------------------------------

vi.mock("../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn(),
}));

// Partial mock of fs: re-export real module plus a spy on listProjectFiles.
// Using importOriginal so ALWAYS_SKIP and other exports remain real.
vi.mock("../../src/utils/fs.js", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    listProjectFiles: vi.fn(actual.listProjectFiles as (...args: unknown[]) => unknown),
  };
});

// Import AFTER mock setup
import { extractConventions } from "../../src/core/pipeline.js";
import { createBridge } from "../../src/core/ez-search-bridge.js";
import { listProjectFiles } from "../../src/utils/fs.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJECT_ROOT = resolve(import.meta.dirname, "../..");

function makeChunk(file: string, text: string) {
  return { file, chunk: text, score: 0.9 };
}

function makeBridge(opts: {
  hasIndex?: boolean;
  searchImpl?: (q: string) => { file: string; chunk: string; score: number }[];
}) {
  const { hasIndex = true, searchImpl } = opts;
  return {
    hasIndex: vi.fn().mockResolvedValue(hasIndex),
    search: vi.fn().mockImplementation((q: string) =>
      Promise.resolve(searchImpl ? searchImpl(q) : [])
    ),
    ensureIndex: vi.fn(),
    embed: vi.fn().mockRejectedValue(new Error("embed not supported")),
  };
}

// ---------------------------------------------------------------------------
// Existing integration test (real project as fixture, bridge will be mocked)
// ---------------------------------------------------------------------------

describe("extractConventions (integration)", () => {
  beforeEach(() => {
    // restoreAllMocks resets listProjectFiles back to the real call-through
    // implementation from the vi.mock factory, preventing mock leakage from
    // other describe blocks that override it with mockResolvedValue([]).
    vi.restoreAllMocks();
    // Default bridge: no index (so semantic extractors return empty arrays)
    vi.mocked(createBridge).mockResolvedValue(
      makeBridge({ hasIndex: false }) as never
    );
  });

  it("returns a valid ConventionRegistry for the ez-context project", async () => {
    const result = await extractConventions(PROJECT_ROOT);

    // Should be schema-valid
    expect(() => ConventionRegistrySchema.parse(result)).not.toThrow();

    // StackInfo should be populated
    expect(result.stack.language).toBe("TypeScript");
    expect(result.stack.packageManager).toBe("bun");
    expect(result.stack.testRunner).toBe("Vitest");

    // Conventions should be populated
    expect(result.conventions.length).toBeGreaterThan(0);

    // Should have entries across multiple categories
    const categories = new Set(result.conventions.map((c) => c.category));
    expect(categories.has("stack")).toBe(true);
    expect(categories.has("naming")).toBe(true);
    expect(categories.has("testing")).toBe(true);

    // No duplicate category+pattern pairs
    const seen = new Set<string>();
    for (const entry of result.conventions) {
      const key = `${entry.category}:${entry.pattern}`;
      expect(seen.has(key), `Duplicate convention found: ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

// ---------------------------------------------------------------------------
// Semantic extractor integration tests
// ---------------------------------------------------------------------------

describe("semantic extractor integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no files for architecture extractor (no MVC dirs by default)
    vi.mocked(listProjectFiles).mockResolvedValue([]);
    // Default bridge: no index
    vi.mocked(createBridge).mockResolvedValue(
      makeBridge({ hasIndex: false }) as never
    );
  });

  it("semantic extractors produce error_handling conventions when index exists", async () => {
    // Bridge: has index, search returns try/catch chunks from 3 distinct files
    const bridge = makeBridge({
      hasIndex: true,
      searchImpl: (q) => {
        if (q.includes("try catch") || q.includes("error handling")) {
          return [
            makeChunk("src/api.ts", "try { await fetch() } catch (err) { console.error(err) }"),
            makeChunk("src/db.ts", "try { await db.query() } catch (err) { throw err }"),
            makeChunk("src/parser.ts", "try { JSON.parse(s) } catch (e) { return null }"),
          ];
        }
        return [];
      },
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const result = await extractConventions(PROJECT_ROOT);

    const errorHandlingEntries = result.conventions.filter(
      (c) => c.category === "error_handling"
    );
    expect(errorHandlingEntries.length).toBeGreaterThan(0);

    const tryCatchEntry = errorHandlingEntries.find((e) =>
      e.pattern.includes("try/catch")
    );
    expect(tryCatchEntry).toBeDefined();
    expect(tryCatchEntry!.confidence).toBeGreaterThan(0.5);
  });

  it("architecture extractor populates registry.architecture", async () => {
    // Files: MVC layout under src/
    vi.mocked(listProjectFiles).mockResolvedValue([
      "src/models/user.ts",
      "src/models/post.ts",
      "src/views/home.ts",
      "src/views/profile.ts",
      "src/controllers/user-controller.ts",
      "src/controllers/post-controller.ts",
    ]);

    // Bridge: has index, search returns MVC-related chunks
    const bridge = makeBridge({
      hasIndex: true,
      searchImpl: () => [
        makeChunk("src/controllers/user-controller.ts", "class UserController { ... }"),
        makeChunk("src/models/user.ts", "class User extends Model { ... }"),
      ],
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const result = await extractConventions(PROJECT_ROOT);

    expect(result.architecture.pattern).toBe("MVC");
    expect(result.architecture.layers.length).toBeGreaterThan(0);
    // Detected layers should reference the MVC directories
    const layerStr = result.architecture.layers.join(",");
    expect(layerStr).toMatch(/model|view|controller/i);
  });

  it("semantic extractors return empty when no index", async () => {
    // Bridge: no index (already default from beforeEach)
    const result = await extractConventions(PROJECT_ROOT);

    const errorHandlingEntries = result.conventions.filter(
      (c) => c.category === "error_handling"
    );
    expect(errorHandlingEntries.length).toBe(0);
    // architecture.pattern stays undefined: no MVC dirs + no index
    expect(result.architecture.pattern).toBeUndefined();
  });

  it("pipeline still works end-to-end with semantic extractors", async () => {
    // Setup: bridge with index + try/catch chunks + MVC file layout
    vi.mocked(listProjectFiles).mockResolvedValue([
      "src/models/user.ts",
      "src/views/home.ts",
      "src/controllers/user-controller.ts",
    ]);

    const bridge = makeBridge({
      hasIndex: true,
      searchImpl: (q) => {
        if (q.includes("try catch") || q.includes("error handling")) {
          return [
            makeChunk("src/api.ts", "try { await fetch() } catch (err) { console.error(err) }"),
            makeChunk("src/db.ts", "try { await db.query() } catch (err) { throw err }"),
            makeChunk("src/parser.ts", "try { JSON.parse(s) } catch (e) { return null }"),
          ];
        }
        return [
          makeChunk("src/controllers/user-controller.ts", "class UserController {}"),
        ];
      },
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const result = await extractConventions(PROJECT_ROOT);

    // Schema must be fully valid
    expect(() => ConventionRegistrySchema.parse(result)).not.toThrow();

    // Both static and semantic conventions should be present
    const categories = new Set(result.conventions.map((c) => c.category));
    expect(categories.has("stack")).toBe(true); // from static extractors
    expect(categories.has("error_handling")).toBe(true); // from semantic extractor
  });
});
