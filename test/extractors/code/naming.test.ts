import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { namingExtractor } from "../../../src/extractors/code/naming.js";

const FIXTURE_CONTENT = `
export function calculateTotal() { return 0; }
export function getUserName() { return ""; }
export function processData() { return null; }
export function handleRequest() { return null; }
export function validateInput() { return true; }
export class UserService {}
export class DataProcessor {}
export class RequestHandler {}
export class InputValidator {}
export class ConfigManager {}
`;

describe("namingExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-naming-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects camelCase functions and PascalCase classes", async () => {
    await writeFile(join(tempDir, "fixture.ts"), FIXTURE_CONTENT);

    const ctx = { projectPath: tempDir };
    const entries = await namingExtractor.extract(ctx);

    const camelCaseEntry = entries.find(
      (e) => e.pattern.toLowerCase().includes("camelcase") && e.pattern.toLowerCase().includes("function")
    );
    expect(camelCaseEntry).toBeDefined();
    expect(camelCaseEntry!.confidence).toBeGreaterThan(0.6);
    expect(camelCaseEntry!.metadata).toHaveProperty("sampleSize");

    const pascalCaseEntry = entries.find(
      (e) => e.pattern.toLowerCase().includes("pascalcase") && e.pattern.toLowerCase().includes("class")
    );
    expect(pascalCaseEntry).toBeDefined();
    expect(pascalCaseEntry!.confidence).toBeGreaterThan(0.6);
    expect(pascalCaseEntry!.metadata).toHaveProperty("sampleSize");
  });

  it("returns empty array for an empty directory", async () => {
    const ctx = { projectPath: tempDir };
    const entries = await namingExtractor.extract(ctx);
    expect(entries).toEqual([]);
  });
});
