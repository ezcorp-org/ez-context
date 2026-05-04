import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { extractConventions } from "../src/core/pipeline.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpectedStack {
  language: string;
  framework?: string;
  testRunner?: string;
  buildTool?: string;
  packageManager?: string;
}

interface ExpectedConvention {
  category: string;
  /** Substrings that should appear in the pattern text of at least one convention in this category. */
  patternSubstrings: string[];
  /** Minimum confidence any matching convention should meet (0-1). */
  minConfidence?: number;
}

interface FixtureExpectation {
  name: string;
  path: string;
  stack: ExpectedStack;
  conventions: ExpectedConvention[];
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fixturesDir = resolve(import.meta.dirname, "fixtures");

const fixtures: FixtureExpectation[] = [
  {
    name: "ts-react-vitest",
    path: resolve(fixturesDir, "ts-react-vitest"),
    stack: {
      language: "TypeScript",
      framework: "React",
      testRunner: "vitest",
      buildTool: "tsc",
    },
    conventions: [
      {
        category: "naming",
        patternSubstrings: ["camelCase"],
        minConfidence: 0.5,
      },
      {
        category: "imports",
        patternSubstrings: ["path aliases", "ES modules"],
        minConfidence: 0.3,
      },
      {
        category: "testing",
        patternSubstrings: ["test/ directory"],
        minConfidence: 0.3,
      },
      {
        category: "stack",
        patternSubstrings: ["strict mode"],
        minConfidence: 0.9,
      },
    ],
  },
  {
    name: "ts-express-jest",
    path: resolve(fixturesDir, "ts-express-jest"),
    stack: {
      language: "TypeScript",
      framework: "Express",
      testRunner: "jest",
    },
    conventions: [
      {
        category: "architecture",
        patternSubstrings: ["MVC"],
        minConfidence: 0.3,
      },
      {
        category: "testing",
        patternSubstrings: ["test/ directory"],
        minConfidence: 0.3,
      },
      {
        category: "imports",
        patternSubstrings: ["ES modules"],
        minConfidence: 0.9,
      },
      {
        category: "error_handling",
        patternSubstrings: ["try/catch"],
        minConfidence: 0.5,
      },
    ],
  },
  {
    name: "go-project",
    path: resolve(fixturesDir, "go-project"),
    stack: {
      language: "Go",
    },
    conventions: [
      {
        category: "stack",
        patternSubstrings: ["Go"],
        minConfidence: 0.5,
      },
    ],
  },
  {
    name: "rust-project",
    path: resolve(fixturesDir, "rust-project"),
    stack: {
      language: "Rust",
    },
    conventions: [
      {
        category: "stack",
        patternSubstrings: ["Rust"],
        minConfidence: 0.5,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MetricResult {
  fixture: string;
  category: string;
  expectedPatterns: string[];
  matchedPatterns: string[];
  precision: number;
  recall: number;
}

function computeMetrics(
  fixtureName: string,
  expected: ExpectedConvention[],
  actual: { category: string; pattern: string; confidence: number }[],
): MetricResult[] {
  return expected.map((exp) => {
    const categoryConventions = actual.filter(
      (c) => c.category === exp.category,
    );
    const allActualPatterns = categoryConventions.map((c) => c.pattern);

    const matchedPatterns = exp.patternSubstrings.filter((sub) =>
      allActualPatterns.some((p) =>
        p.toLowerCase().includes(sub.toLowerCase()),
      ),
    );

    const recall =
      exp.patternSubstrings.length > 0
        ? matchedPatterns.length / exp.patternSubstrings.length
        : 1;

    // Precision: of all conventions in this category, how many matched at least one expected substring?
    const relevantActual = categoryConventions.filter((c) =>
      exp.patternSubstrings.some((sub) =>
        c.pattern.toLowerCase().includes(sub.toLowerCase()),
      ),
    );
    const precision =
      categoryConventions.length > 0
        ? relevantActual.length / categoryConventions.length
        : 0;

    return {
      fixture: fixtureName,
      category: exp.category,
      expectedPatterns: exp.patternSubstrings,
      matchedPatterns,
      precision,
      recall,
    };
  });
}

function logMetrics(metrics: MetricResult[]): void {
  console.log("\n--- Accuracy Metrics ---");
  console.log(
    "Fixture".padEnd(20),
    "Category".padEnd(16),
    "Precision".padEnd(12),
    "Recall".padEnd(12),
    "Matched",
  );
  console.log("-".repeat(80));

  for (const m of metrics) {
    console.log(
      m.fixture.padEnd(20),
      m.category.padEnd(16),
      m.precision.toFixed(2).padEnd(12),
      m.recall.toFixed(2).padEnd(12),
      `${m.matchedPatterns.join(", ") || "(none)"} / ${m.expectedPatterns.join(", ")}`,
    );
  }

  const avgRecall =
    metrics.reduce((sum, m) => sum + m.recall, 0) / metrics.length;
  const avgPrecision =
    metrics.reduce((sum, m) => sum + m.precision, 0) / metrics.length;
  console.log("-".repeat(80));
  console.log(
    "AVERAGE".padEnd(20),
    "".padEnd(16),
    avgPrecision.toFixed(2).padEnd(12),
    avgRecall.toFixed(2).padEnd(12),
  );
  console.log();
}

function assertStack(
  actual: Record<string, unknown>,
  expected: ExpectedStack,
  fixtureName: string,
): void {
  for (const [key, value] of Object.entries(expected)) {
    expect(
      String(actual[key]).toLowerCase(),
      `${fixtureName}: stack.${key} should contain "${value}"`,
    ).toContain(String(value).toLowerCase());
  }
}

function assertConventions(
  actual: { category: string; pattern: string; confidence: number }[],
  expected: ExpectedConvention[],
): void {
  for (const exp of expected) {
    const inCategory = actual.filter((c) => c.category === exp.category);
    expect(
      inCategory.length,
      `Expected at least one convention in category "${exp.category}"`,
    ).toBeGreaterThan(0);

    for (const sub of exp.patternSubstrings) {
      const match = inCategory.find((c) =>
        c.pattern.toLowerCase().includes(sub.toLowerCase()),
      );
      expect(
        match,
        `Expected a "${exp.category}" convention matching "${sub}". Got patterns: ${inCategory.map((c) => `"${c.pattern}"`).join(", ")}`,
      ).toBeDefined();

      if (match && exp.minConfidence !== undefined) {
        expect(
          match.confidence,
          `Convention "${sub}" confidence ${match.confidence} below threshold ${exp.minConfidence}`,
        ).toBeGreaterThanOrEqual(exp.minConfidence);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("accuracy benchmark", () => {
  const allMetrics: MetricResult[] = [];

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      let registry: Awaited<ReturnType<typeof extractConventions>>;

      it("extracts conventions without error", async () => {
        registry = await extractConventions(fixture.path);
        expect(registry).toBeDefined();
        expect(registry.stack).toBeDefined();
        expect(registry.conventions).toBeDefined();
      });

      it("detects correct stack", () => {
        expect(registry).toBeDefined();
        assertStack(
          registry.stack as unknown as Record<string, unknown>,
          fixture.stack,
          fixture.name,
        );
      });

      it("finds expected convention categories", () => {
        expect(registry).toBeDefined();
        const categories = new Set<string>(registry.conventions.map((c) => c.category));
        for (const exp of fixture.conventions) {
          expect(
            categories.has(exp.category),
            `Missing category "${exp.category}" in ${fixture.name}. Found: ${[...categories].join(", ")}`,
          ).toBe(true);
        }
      });

      it("matches expected patterns with sufficient confidence", () => {
        expect(registry).toBeDefined();
        const actual = registry.conventions.map((c) => ({
          category: c.category,
          pattern: c.pattern,
          confidence: c.confidence,
        }));
        assertConventions(actual, fixture.conventions);
      });

      it("computes precision/recall metrics", () => {
        expect(registry).toBeDefined();
        const actual = registry.conventions.map((c) => ({
          category: c.category,
          pattern: c.pattern,
          confidence: c.confidence,
        }));
        const metrics = computeMetrics(fixture.name, fixture.conventions, actual);
        allMetrics.push(...metrics);

        // Log per-fixture metrics inline
        for (const m of metrics) {
          console.log(
            `  [${m.fixture}/${m.category}] recall=${m.recall.toFixed(2)} precision=${m.precision.toFixed(2)}`,
          );
        }
      });
    });
  }

  it("logs aggregate metrics", () => {
    logMetrics(allMetrics);
    // Overall recall should be high — all expected patterns must be found
    if (allMetrics.length > 0) {
      const avgRecall =
        allMetrics.reduce((sum, m) => sum + m.recall, 0) / allMetrics.length;
      expect(
        avgRecall,
        `Average recall ${avgRecall.toFixed(2)} is below 1.0 threshold`,
      ).toBeGreaterThanOrEqual(1.0);
    }
  });
});
