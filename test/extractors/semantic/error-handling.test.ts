import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock createBridge -- factory uses only vi.fn() (no external variable refs)
// vi.mock is hoisted to top; external variable refs would fail initialization.
// ---------------------------------------------------------------------------

vi.mock("../../../src/core/ez-search-bridge.js", () => ({
  createBridge: vi.fn(),
}));

// Import AFTER mock setup
import { errorHandlingExtractor } from "../../../src/extractors/semantic/error-handling.js";
import { createBridge } from "../../../src/core/ez-search-bridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChunk(file: string, text: string) {
  return { file, chunk: text, score: 0.9 };
}

function makeBridge(overrides: {
  hasIndex?: boolean;
  searchImpl?: (q: string) => { file: string; chunk: string; score: number }[];
}) {
  const { hasIndex = true, searchImpl } = overrides;
  return {
    hasIndex: vi.fn().mockResolvedValue(hasIndex),
    search: vi.fn().mockImplementation((q: string) => {
      return Promise.resolve(searchImpl ? searchImpl(q) : []);
    }),
    ensureIndex: vi.fn(),
    embed: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("errorHandlingExtractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detects try/catch pattern when search returns chunks from 3+ files", async () => {
    const bridge = makeBridge({
      searchImpl: (q) => {
        if (q.includes("try catch")) {
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

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    const tryCatchEntry = entries.find((e) => e.pattern.includes("try/catch"));
    expect(tryCatchEntry).toBeDefined();
    expect(tryCatchEntry!.category).toBe("error_handling");
    expect(tryCatchEntry!.confidence).toBeGreaterThan(0.5);
    expect(tryCatchEntry!.metadata).toMatchObject({ style: "try-catch" });
    expect(tryCatchEntry!.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it("detects Result type pattern from functional-style chunks", async () => {
    const bridge = makeBridge({
      searchImpl: (q) => {
        if (q.includes("Result Ok Err")) {
          return [
            makeChunk("src/auth.ts", "const result: Result<User, Error> = Ok(user)"),
            makeChunk("src/parser.ts", "return Err(new ParseError('invalid'))"),
            makeChunk("src/fetcher.ts", "if (isOk(result)) { return result.value }"),
          ];
        }
        return [];
      },
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    const resultEntry = entries.find((e) => e.pattern.includes("Result"));
    expect(resultEntry).toBeDefined();
    expect(resultEntry!.metadata).toMatchObject({ style: "result-type" });
  });

  it("returns [] when hasIndex returns false (no index)", async () => {
    const bridge = makeBridge({ hasIndex: false });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    expect(entries).toEqual([]);
    expect(bridge.search).not.toHaveBeenCalled();
  });

  it("returns [] when search returns empty results", async () => {
    const bridge = makeBridge({ searchImpl: () => [] });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    expect(entries).toEqual([]);
  });

  it("skips patterns found in only 1 file (below 2-file minimum)", async () => {
    const bridge = makeBridge({
      searchImpl: (q) => {
        if (q.includes("try catch")) {
          // Only 1 unique file -- should be filtered out
          return [makeChunk("src/only-file.ts", "try { doSomething() } catch (e) { log(e) }")];
        }
        return [];
      },
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    const tryCatchEntry = entries.find((e) => e.pattern.includes("try/catch"));
    expect(tryCatchEntry).toBeUndefined();
  });

  it("confidence is capped at 0.95 even with many matching files", async () => {
    const manyChunks = Array.from({ length: 50 }, (_, i) =>
      makeChunk(`src/file${i}.ts`, `try { op${i}() } catch (e) { handle(e) }`)
    );

    const bridge = makeBridge({
      searchImpl: (q) => {
        if (q.includes("try catch")) return manyChunks;
        return [];
      },
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    const tryCatchEntry = entries.find((e) => e.pattern.includes("try/catch"));
    expect(tryCatchEntry).toBeDefined();
    expect(tryCatchEntry!.confidence).toBeLessThanOrEqual(0.95);
  });

  it("detects error-boundary pattern from React components", async () => {
    const bridge = makeBridge({
      searchImpl: (q) => {
        if (q.includes("try catch") || q.includes("error handling")) {
          return [
            makeChunk("src/ErrorBoundary.tsx", "class ErrorBoundary extends React.Component { componentDidCatch(err) {} }"),
            makeChunk("src/AppErrorBoundary.tsx", "export class AppErrorBoundary extends ErrorBoundary {}"),
          ];
        }
        return [];
      },
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    const boundaryEntry = entries.find((e) => e.metadata?.style === "error-boundary");
    expect(boundaryEntry).toBeDefined();
    expect(boundaryEntry!.category).toBe("error_handling");
    expect(boundaryEntry!.metadata?.fileCount).toBe(2);
  });

  it("deduplicates chunks from multiple search queries by file", async () => {
    const bridge = makeBridge({
      searchImpl: (q) => {
        if (q.includes("try catch")) {
          return [
            makeChunk("src/shared.ts", "try { a() } catch (e) { b() }"),
            makeChunk("src/other.ts", "try { c() } catch (e) { d() }"),
          ];
        }
        if (q.includes("custom error")) {
          return [
            // src/shared.ts returned again -- merged, not duplicated
            makeChunk("src/shared.ts", "class NetworkError extends Error {}"),
            makeChunk("src/errors.ts", "class AppError extends Error {}"),
          ];
        }
        return [];
      },
    });
    vi.mocked(createBridge).mockResolvedValue(bridge as never);

    const entries = await errorHandlingExtractor.extract({ projectPath: "/project" });

    // try/catch detected from 2 unique files (src/shared.ts, src/other.ts)
    const tryCatch = entries.find((e) => e.metadata?.style === "try-catch");
    expect(tryCatch).toBeDefined();

    // custom-error detected from 2 unique files: src/shared.ts (merged content) + src/errors.ts
    const customErr = entries.find((e) => e.metadata?.style === "custom-error-class");
    expect(customErr).toBeDefined();
    expect(customErr!.metadata?.fileCount).toBe(2);
  });
});
