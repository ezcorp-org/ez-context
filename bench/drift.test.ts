import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { extractClaims, type Claim } from "../src/core/drift/claim-extractor.js";
import {
  scoreClaims,
  type ScoredClaim,
  type ClaimStatus,
  GREEN_THRESHOLD,
  YELLOW_THRESHOLD,
} from "../src/core/drift/claim-scorer.js";
import {
  computeHealthScore,
  buildDriftReport,
  renderDriftReport,
} from "../src/core/drift/report.js";
import { extractConventions } from "../src/core/pipeline.js";
import { emit } from "../src/emitters/index.js";
import type { EzSearchBridge, SearchResult } from "../src/core/ez-search-bridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(import.meta.dirname, "fixtures/ts-react-vitest");

function makeClaim(text: string, section = "Test Section"): Claim {
  return { text, sourceFile: "test.md", sourceLine: 1, sourceSection: section };
}

function makeScoredClaim(
  text: string,
  score: number,
  status?: ClaimStatus,
): ScoredClaim {
  const resolved: ClaimStatus =
    status ?? (score >= GREEN_THRESHOLD ? "GREEN" : score >= YELLOW_THRESHOLD ? "YELLOW" : "RED");
  return {
    claim: makeClaim(text),
    status: resolved,
    score,
    evidence: [{ file: "src/index.ts", chunk: "matching code chunk", score }],
  };
}

/**
 * Build a mock EzSearchBridge that returns high scores for queries containing
 * any of `knownTerms`, and low scores for everything else.
 */
function createMockBridge(knownTerms: string[]): EzSearchBridge {
  return {
    async hasIndex() {
      return true;
    },
    async ensureIndex() {},
    async search(query: string, opts?: { k?: number }): Promise<SearchResult[]> {
      const k = opts?.k ?? 5;
      const isKnown = knownTerms.some((t) =>
        query.toLowerCase().includes(t.toLowerCase()),
      );
      const score = isKnown ? 0.85 : 0.15;
      const results: SearchResult[] = Array.from({ length: k }, (_, i) => ({
        file: `src/file${i}.ts`,
        chunk: `code snippet matching "${query}"`,
        score: Math.max(0, score - i * 0.05),
      }));
      return results;
    },
    async embed(_text: string) {
      return [0.1, 0.2, 0.3];
    },
    async refreshIndex(_projectPath: string) {},
  };
}

// ---------------------------------------------------------------------------
// 1. Claim extraction from generated output
// ---------------------------------------------------------------------------

describe("claim extraction from generated output", () => {
  it("extracts claims from ts-react-vitest context", async () => {
    const registry = await extractConventions(FIXTURE_PATH);
    const { rendered } = await emit(registry, {
      outputDir: FIXTURE_PATH,
      formats: ["claude"],
      dryRun: true,
    });

    const claudeContent = rendered["claude"]!;
    expect(claudeContent.length).toBeGreaterThan(0);

    const claims = extractClaims(claudeContent, "CLAUDE.md");
    expect(claims.length).toBeGreaterThan(0);

    for (const claim of claims) {
      expect(claim.sourceSection).toBeTruthy();
      expect(claim.sourceSection.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Health score computation
// ---------------------------------------------------------------------------

describe("health score computation", () => {
  it("yields high score for all-GREEN claims", () => {
    const scored: ScoredClaim[] = [
      makeScoredClaim("Uses React for UI components", 0.90, "GREEN"),
      makeScoredClaim("Vitest is the test runner", 0.85, "GREEN"),
      makeScoredClaim("TypeScript strict mode enabled", 0.80, "GREEN"),
    ];
    const health = computeHealthScore(scored);
    expect(health).toBeGreaterThanOrEqual(80);
  });

  it("yields low score for all-RED claims", () => {
    const scored: ScoredClaim[] = [
      makeScoredClaim("Uses Angular for components", 0.10, "RED"),
      makeScoredClaim("Mocha is the test runner", 0.15, "RED"),
      makeScoredClaim("JavaScript with no types", 0.20, "RED"),
    ];
    const health = computeHealthScore(scored);
    expect(health).toBeLessThanOrEqual(30);
  });

  it("returns 100 for empty claims", () => {
    expect(computeHealthScore([])).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 3. Mock bridge scoring
// ---------------------------------------------------------------------------

describe("mock bridge scoring", () => {
  it("scores real claims against a mock bridge end-to-end", async () => {
    const registry = await extractConventions(FIXTURE_PATH);
    const { rendered } = await emit(registry, {
      outputDir: FIXTURE_PATH,
      formats: ["claude"],
      dryRun: true,
    });

    const claims = extractClaims(rendered["claude"]!, "CLAUDE.md");
    expect(claims.length).toBeGreaterThan(0);

    // The mock bridge recognises terms likely present in the generated context
    const bridge = createMockBridge(["react", "vitest", "typescript", "hook", "component"]);
    const scored = await scoreClaims(claims, bridge);

    expect(scored.length).toBe(claims.length);

    for (const sc of scored) {
      expect(["GREEN", "YELLOW", "RED"]).toContain(sc.status);
      expect(sc.score).toBeGreaterThanOrEqual(0);
      expect(sc.score).toBeLessThanOrEqual(1);
      expect(sc.evidence.length).toBeGreaterThan(0);
    }
  });

  it("returns low scores for stale claims against the mock bridge", async () => {
    const staleClaims: Claim[] = [
      makeClaim("The project uses Svelte for rendering"),
      makeClaim("All tests are written with Cypress"),
      makeClaim("The build system is powered by Webpack"),
    ];

    const bridge = createMockBridge(["react", "vitest", "typescript"]);
    const scored = await scoreClaims(staleClaims, bridge);

    for (const sc of scored) {
      expect(sc.status).not.toBe("GREEN");
      expect(sc.score).toBeLessThan(GREEN_THRESHOLD);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Drift detection simulation
// ---------------------------------------------------------------------------

describe("drift detection simulation", () => {
  it("detects staleness when project switches from Vitest to Jest", async () => {
    const registry = await extractConventions(FIXTURE_PATH);
    const { rendered } = await emit(registry, {
      outputDir: FIXTURE_PATH,
      formats: ["claude"],
      dryRun: true,
    });

    const claims = extractClaims(rendered["claude"]!, "CLAUDE.md");

    // Simulate: the project switched to Jest, so Vitest-related claims are now stale
    const scored: ScoredClaim[] = claims.map((claim) => {
      const mentionsVitest = claim.text.toLowerCase().includes("vitest");
      if (mentionsVitest) {
        return {
          claim,
          status: "RED" as ClaimStatus,
          score: 0.15,
          evidence: [
            { file: "jest.config.ts", chunk: "export default { preset: 'ts-jest' }", score: 0.15 },
          ],
        };
      }
      return {
        claim,
        status: "GREEN" as ClaimStatus,
        score: 0.85,
        evidence: [
          { file: "src/index.ts", chunk: "matching code", score: 0.85 },
        ],
      };
    });

    const health = computeHealthScore(scored);
    // Any RED claims should drag the score below 100
    const hasRedClaims = scored.some((sc) => sc.status === "RED");
    if (hasRedClaims) {
      expect(health).toBeLessThan(100);
    }

    const report = buildDriftReport("CLAUDE.md", scored);
    const rendered_report = renderDriftReport(report);

    expect(rendered_report).toContain("# Drift Report");
    expect(rendered_report).toContain("Health Score");
    expect(rendered_report).toContain(String(health));
  });
});

// ---------------------------------------------------------------------------
// 5. Report rendering
// ---------------------------------------------------------------------------

describe("report rendering", () => {
  it("renders a report with all expected markdown sections", () => {
    const scored: ScoredClaim[] = [
      makeScoredClaim("React is used for UI", 0.90, "GREEN"),
      makeScoredClaim("Redux manages state", 0.50, "YELLOW"),
      makeScoredClaim("Angular is the framework", 0.10, "RED"),
    ];

    const report = buildDriftReport("CLAUDE.md", scored);
    const md = renderDriftReport(report);

    // Header section
    expect(md).toContain("# Drift Report");
    expect(md).toContain("**Health Score:**");
    expect(md).toContain("**File:** CLAUDE.md");
    expect(md).toContain("**Claims:** 3");

    // Status sections
    expect(md).toContain("## Confirmed (GREEN)");
    expect(md).toContain("## Possibly Stale (YELLOW)");
    expect(md).toContain("## Contradicted (RED)");

    // Health score value present
    const health = computeHealthScore(scored);
    expect(md).toContain(`${health}/100`);

    // Summary line
    expect(md).toContain("Summary: 1 confirmed, 1 possibly stale, 1 contradicted");
  });

  it("omits empty status sections", () => {
    const scored: ScoredClaim[] = [
      makeScoredClaim("Everything is green", 0.95, "GREEN"),
    ];

    const report = buildDriftReport("CLAUDE.md", scored);
    const md = renderDriftReport(report);

    expect(md).toContain("## Confirmed (GREEN)");
    expect(md).not.toContain("## Possibly Stale (YELLOW)");
    expect(md).not.toContain("## Contradicted (RED)");
  });
});
