import { describe, it, expect } from "vitest";
import {
  ConventionRegistrySchema,
  EvidenceRefSchema,
  ConventionCategorySchema,
  type ConventionRegistry,
} from "../../src/core/schema.js";
import { createRegistry, addConvention } from "../../src/core/registry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalRegistry(): ConventionRegistry {
  return {
    version: "1",
    projectPath: "/home/user/project",
    generatedAt: new Date().toISOString(),
    stack: { language: "typescript" },
    conventions: [],
    architecture: { layers: [] },
  };
}

// ---------------------------------------------------------------------------
// ConventionRegistrySchema
// ---------------------------------------------------------------------------

describe("ConventionRegistrySchema", () => {
  it("accepts a valid minimal registry", () => {
    const result = ConventionRegistrySchema.safeParse(minimalRegistry());
    expect(result.success).toBe(true);
  });

  it("accepts a registry with conventions and optional fields", () => {
    const registry: ConventionRegistry = {
      ...minimalRegistry(),
      stack: {
        language: "typescript",
        framework: "express",
        testRunner: "vitest",
        buildTool: "tsdown",
        packageManager: "bun",
        nodeVersion: "20",
      },
      conventions: [
        {
          id: crypto.randomUUID(),
          category: "naming",
          pattern: "camelCase for variables",
          confidence: 0.95,
          evidence: [{ file: "src/index.ts", line: 1 }],
          metadata: { source: "analysis" },
        },
      ],
      architecture: {
        pattern: "layered",
        layers: ["api", "core", "utils"],
        entryPoints: ["src/index.ts"],
      },
      metadata: { analyzedAt: "2026-01-01" },
    };
    const result = ConventionRegistrySchema.safeParse(registry);
    expect(result.success).toBe(true);
  });

  it("rejects confidence > 1", () => {
    const registry = {
      ...minimalRegistry(),
      conventions: [
        {
          id: crypto.randomUUID(),
          category: "naming",
          pattern: "camelCase",
          confidence: 1.1,
          evidence: [],
        },
      ],
    };
    const result = ConventionRegistrySchema.safeParse(registry);
    expect(result.success).toBe(false);
  });

  it("rejects confidence < 0", () => {
    const registry = {
      ...minimalRegistry(),
      conventions: [
        {
          id: crypto.randomUUID(),
          category: "naming",
          pattern: "camelCase",
          confidence: -0.1,
          evidence: [],
        },
      ],
    };
    const result = ConventionRegistrySchema.safeParse(registry);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields (no projectPath)", () => {
    const reg = minimalRegistry() as Record<string, unknown>;
    delete reg["projectPath"];
    const result = ConventionRegistrySchema.safeParse(reg);
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields (no stack)", () => {
    const reg = minimalRegistry() as Record<string, unknown>;
    delete reg["stack"];
    const result = ConventionRegistrySchema.safeParse(reg);
    expect(result.success).toBe(false);
  });

  it("rejects invalid version literal", () => {
    const result = ConventionRegistrySchema.safeParse({
      ...minimalRegistry(),
      version: "2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty pattern in convention entry", () => {
    const result = ConventionRegistrySchema.safeParse({
      ...minimalRegistry(),
      conventions: [
        {
          id: crypto.randomUUID(),
          category: "naming",
          pattern: "",
          confidence: 0.5,
          evidence: [],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EvidenceRefSchema: nullable line
// ---------------------------------------------------------------------------

describe("EvidenceRefSchema", () => {
  it("accepts null line", () => {
    const result = EvidenceRefSchema.safeParse({ file: "src/a.ts", line: null });
    expect(result.success).toBe(true);
  });

  it("accepts a positive integer line", () => {
    const result = EvidenceRefSchema.safeParse({ file: "src/a.ts", line: 42 });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ConventionCategorySchema
// ---------------------------------------------------------------------------

describe("ConventionCategorySchema", () => {
  const validCategories = [
    "stack", "naming", "architecture", "error_handling",
    "testing", "imports", "other",
  ] as const;

  for (const cat of validCategories) {
    it(`accepts category: ${cat}`, () => {
      expect(ConventionCategorySchema.safeParse(cat).success).toBe(true);
    });
  }

  it("rejects unknown category", () => {
    expect(ConventionCategorySchema.safeParse("unknown_cat").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Type inference compile-time check
// ---------------------------------------------------------------------------

describe("Type inference", () => {
  it("ConventionRegistry satisfies schema shape (compile-time)", () => {
    // If this file compiles, the type check passes
    const reg = minimalRegistry() satisfies ConventionRegistry;
    expect(reg.version).toBe("1");
  });
});

// ---------------------------------------------------------------------------
// createRegistry and addConvention
// ---------------------------------------------------------------------------

describe("createRegistry", () => {
  it("produces a valid registry", () => {
    const reg = createRegistry("/path/to/project");
    const result = ConventionRegistrySchema.safeParse(reg);
    expect(result.success).toBe(true);
  });

  it("sets version to '1'", () => {
    expect(createRegistry("/p").version).toBe("1");
  });

  it("sets the provided projectPath", () => {
    expect(createRegistry("/my/project").projectPath).toBe("/my/project");
  });

  it("starts with empty conventions array", () => {
    expect(createRegistry("/p").conventions).toHaveLength(0);
  });

  it("generatedAt is a valid ISO datetime", () => {
    const reg = createRegistry("/p");
    expect(() => new Date(reg.generatedAt).toISOString()).not.toThrow();
  });
});

describe("addConvention", () => {
  it("adds a convention with a generated UUID", () => {
    const reg = createRegistry("/p");
    const updated = addConvention(reg, {
      category: "naming",
      pattern: "camelCase for variables",
      confidence: 0.9,
      evidence: [],
    });
    expect(updated.conventions).toHaveLength(1);
    const entry = updated.conventions[0]!;
    expect(entry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("does not mutate the original registry", () => {
    const reg = createRegistry("/p");
    addConvention(reg, {
      category: "testing",
      pattern: "describe/it blocks",
      confidence: 0.8,
      evidence: [],
    });
    expect(reg.conventions).toHaveLength(0);
  });

  it("produced registry passes schema validation", () => {
    const reg = createRegistry("/p");
    const updated = addConvention(reg, {
      category: "imports",
      pattern: "explicit .js extensions",
      confidence: 1.0,
      evidence: [{ file: "src/index.ts", line: null }],
    });
    expect(ConventionRegistrySchema.safeParse(updated).success).toBe(true);
  });
});
