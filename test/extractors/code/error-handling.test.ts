import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { staticErrorHandlingExtractor } from "../../../src/extractors/code/error-handling.js";

const TRY_CATCH_FIXTURE = `
export async function fetchData(url: string) {
  try {
    const res = await fetch(url);
    return res.json();
  } catch (err) {
    console.error("fetch failed", err);
    return null;
  }
}

export function parseConfig(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
`;

const CUSTOM_ERROR_FIXTURE = `
export class NotFoundError extends Error {
  constructor(resource: string) {
    super(\`\${resource} not found\`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(field: string) {
    super(\`Invalid value for \${field}\`);
    this.name = "ValidationError";
  }
}
`;

describe("staticErrorHandlingExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-error-handling-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects try/catch error handling pattern", async () => {
    await writeFile(join(tempDir, "service.ts"), TRY_CATCH_FIXTURE);

    const entries = await staticErrorHandlingExtractor.extract({ projectPath: tempDir });

    const tryCatchEntry = entries.find((e) => e.pattern.includes("try/catch"));
    expect(tryCatchEntry).toBeDefined();
    expect(tryCatchEntry!.category).toBe("error_handling");
    expect(tryCatchEntry!.metadata?.style).toBe("try-catch");
    expect(tryCatchEntry!.metadata?.totalCount).toBeGreaterThanOrEqual(2);
    expect(tryCatchEntry!.evidence!.length).toBeGreaterThan(0);
  });

  it("detects custom error classes extending Error", async () => {
    await writeFile(join(tempDir, "errors.ts"), CUSTOM_ERROR_FIXTURE);

    const entries = await staticErrorHandlingExtractor.extract({ projectPath: tempDir });

    const customErrorEntry = entries.find((e) => e.pattern.includes("custom error class"));
    expect(customErrorEntry).toBeDefined();
    expect(customErrorEntry!.category).toBe("error_handling");
    expect(customErrorEntry!.metadata?.style).toBe("custom-error-class");
    expect(customErrorEntry!.metadata?.classCount).toBe(2);
    expect(customErrorEntry!.evidence!.length).toBeGreaterThan(0);
  });

  it("returns empty array when no error handling patterns found", async () => {
    await writeFile(join(tempDir, "plain.ts"), "export const x = 1;\nexport function add(a: number, b: number) { return a + b; }");

    const entries = await staticErrorHandlingExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });

  it("returns empty array when no TypeScript files exist", async () => {
    const entries = await staticErrorHandlingExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });

  it("respects maxFilesForAst option", async () => {
    // Create 3 files, each with try/catch
    await writeFile(join(tempDir, "a.ts"), TRY_CATCH_FIXTURE);
    await writeFile(join(tempDir, "b.ts"), TRY_CATCH_FIXTURE);
    await writeFile(join(tempDir, "c.ts"), TRY_CATCH_FIXTURE);

    // Limit to 1 file — should still detect the pattern (2 try/catch in one file)
    const entries = await staticErrorHandlingExtractor.extract({
      projectPath: tempDir,
      options: { maxFilesForAst: 1 },
    });

    const tryCatchEntry = entries.find((e) => e.pattern.includes("try/catch"));
    expect(tryCatchEntry).toBeDefined();
    // With only 1 file analyzed, fileCount should be 1
    expect(tryCatchEntry!.metadata?.fileCount).toBe(1);
  });

  it("confidence values are within valid range (0-1)", async () => {
    await writeFile(join(tempDir, "service.ts"), TRY_CATCH_FIXTURE);
    await writeFile(join(tempDir, "errors.ts"), CUSTOM_ERROR_FIXTURE);

    const entries = await staticErrorHandlingExtractor.extract({ projectPath: tempDir });

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(1);
    }
  });
});
