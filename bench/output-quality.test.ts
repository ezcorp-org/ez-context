import { describe, it, expect, beforeAll } from "vitest";
import { resolve } from "node:path";
import { extractConventions } from "../src/core/pipeline.js";
import { FORMAT_EMITTER_MAP } from "../src/emitters/index.js";
import type { OutputFormat } from "../src/emitters/types.js";
import type { ConventionRegistry } from "../src/core/schema.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_FORMATS = Object.keys(FORMAT_EMITTER_MAP) as OutputFormat[];
const THRESHOLD = 0.7;

function fixturePath(name: string): string {
  return resolve(import.meta.dirname, "fixtures", name);
}

function renderAll(registry: ConventionRegistry): Record<OutputFormat, string> {
  const result = {} as Record<OutputFormat, string>;
  for (const format of ALL_FORMATS) {
    result[format] = FORMAT_EMITTER_MAP[format].render(registry, THRESHOLD);
  }
  return result;
}

/**
 * Lines allowed to repeat: blanks, markdown separators, code fences,
 * and short list items (which naturally recur across sections).
 */
function isDuplicateAllowed(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed === "---") return true;
  if (trimmed.startsWith("```")) return true;
  // Short list items (e.g. "- Test runner: Jest") repeat across summary + detail sections
  if (trimmed.startsWith("- ") && trimmed.length < 80) return true;
  return false;
}

function findDuplicateLines(output: string): string[] {
  const lines = output.split("\n");
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isDuplicateAllowed(trimmed)) continue;
    if (seen.has(trimmed)) {
      duplicates.push(trimmed);
    } else {
      seen.add(trimmed);
    }
  }
  return duplicates;
}

/** Check for unclosed code blocks (odd number of ``` fences). */
function hasUnclosedCodeBlocks(output: string): boolean {
  const fences = output.split("\n").filter((l) => l.trim().startsWith("```"));
  return fences.length % 2 !== 0;
}

function conventionsAboveThreshold(registry: ConventionRegistry): ConventionRegistry["conventions"] {
  return registry.conventions.filter((c) => c.confidence >= THRESHOLD);
}

function uniqueCategories(conventions: ConventionRegistry["conventions"]): Set<string> {
  return new Set(conventions.map((c) => c.category));
}

// ---------------------------------------------------------------------------
// Fixture extraction (shared across tests)
// ---------------------------------------------------------------------------

const TS_FIXTURES = ["ts-react-vitest", "ts-express-jest"] as const;

const registries = new Map<string, ConventionRegistry>();
const rendered = new Map<string, Record<OutputFormat, string>>();

function getRegistry(name: string): ConventionRegistry {
  const reg = registries.get(name);
  if (!reg) throw new Error(`Registry not found for ${name}`);
  return reg;
}

function getRendered(name: string): Record<OutputFormat, string> {
  const r = rendered.get(name);
  if (!r) throw new Error(`Rendered output not found for ${name}`);
  return r;
}

beforeAll(async () => {
  for (const name of TS_FIXTURES) {
    const reg = await extractConventions(fixturePath(name));
    registries.set(name, reg);
    rendered.set(name, renderAll(reg));
  }
}, 30_000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("output quality", () => {
  describe.each(TS_FIXTURES)("%s", (fixture) => {
    it("should extract >= 5 conventions at threshold 0.7", () => {
      const above = conventionsAboveThreshold(getRegistry(fixture));
      expect(above.length).toBeGreaterThanOrEqual(5);
    });

    it("should cover at least 2 categories at threshold 0.7", () => {
      const above = conventionsAboveThreshold(getRegistry(fixture));
      const categories = uniqueCategories(above);
      expect(categories.size).toBeGreaterThanOrEqual(2);
    });

    it("should render all 7 formats without throwing", () => {
      expect(Object.keys(getRendered(fixture))).toHaveLength(7);
    });

    it.each(ALL_FORMATS)("format %s produces non-empty output", (format) => {
      expect(getRendered(fixture)[format].trim().length).toBeGreaterThan(0);
    });

    it.each(ALL_FORMATS)("format %s has no duplicate non-empty lines", (format) => {
      const dupes = findDuplicateLines(getRendered(fixture)[format]);
      expect(dupes, `Duplicate lines found:\n${dupes.join("\n")}`).toEqual([]);
    });

    it.each(ALL_FORMATS)("format %s has no unclosed code blocks", (format) => {
      expect(hasUnclosedCodeBlocks(getRendered(fixture)[format])).toBe(false);
    });
  });

  describe("format-specific content", () => {
    it("cursor format starts with YAML frontmatter", () => {
      for (const fixture of TS_FIXTURES) {
        expect(getRendered(fixture).cursor).toMatch(/^---\n/);
      }
    });

    it("claude format contains '# Project Context'", () => {
      for (const fixture of TS_FIXTURES) {
        expect(getRendered(fixture).claude).toContain("# Project Context");
      }
    });

    it("agents format contains '# AGENTS.md'", () => {
      for (const fixture of TS_FIXTURES) {
        expect(getRendered(fixture).agents).toContain("# AGENTS.md");
      }
    });

    it("copilot format contains '# Copilot Instructions'", () => {
      for (const fixture of TS_FIXTURES) {
        expect(getRendered(fixture).copilot).toContain("# Copilot Instructions");
      }
    });
  });
});
