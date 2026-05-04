import { describe, it, expect } from "vitest";
import {
  computeHealthScore,
  buildDriftReport,
  renderDriftReport,
  type DriftReport,
} from "../../../src/core/drift/report.js";
import type { ScoredClaim } from "../../../src/core/drift/claim-scorer.js";
import type { Claim } from "../../../src/core/drift/claim-extractor.js";
import type { SearchResult } from "../../../src/core/ez-search-bridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClaim(text: string): Claim {
  return { text, sourceFile: "CLAUDE.md", sourceLine: 1, sourceSection: "Section" };
}

function makeEvidence(score: number): SearchResult[] {
  return [
    { file: "src/auth.ts", chunk: "const jwt = require('jsonwebtoken')", score },
    { file: "src/middleware.ts", chunk: "app.use(authenticate)", score: score - 0.05 },
  ];
}

function makeScoredClaim(
  text: string,
  status: ScoredClaim["status"],
  score: number,
  evidence: SearchResult[] = []
): ScoredClaim {
  return { claim: makeClaim(text), status, score, evidence };
}

// ---------------------------------------------------------------------------
// computeHealthScore
// ---------------------------------------------------------------------------

describe("computeHealthScore", () => {
  it("returns 100 for empty claims array", () => {
    expect(computeHealthScore([])).toBe(100);
  });

  it("computes mean of scores * 100 (rounded)", () => {
    const scoredClaims: ScoredClaim[] = [
      makeScoredClaim("claim A", "GREEN", 0.8),
      makeScoredClaim("claim B", "YELLOW", 0.5),
      makeScoredClaim("claim C", "RED", 0.2),
    ];
    // mean(0.8, 0.5, 0.2) = 0.5; 0.5 * 100 = 50
    expect(computeHealthScore(scoredClaims)).toBe(50);
  });

  it("returns 100 for all-GREEN perfect scores", () => {
    const scoredClaims: ScoredClaim[] = [
      makeScoredClaim("claim A", "GREEN", 1.0),
      makeScoredClaim("claim B", "GREEN", 1.0),
    ];
    expect(computeHealthScore(scoredClaims)).toBe(100);
  });

  it("returns 0 for all-zero scores", () => {
    const scoredClaims: ScoredClaim[] = [
      makeScoredClaim("claim A", "RED", 0.0),
      makeScoredClaim("claim B", "RED", 0.0),
    ];
    expect(computeHealthScore(scoredClaims)).toBe(0);
  });

  it("rounds the result", () => {
    // mean(0.666...) * 100 = 66.6... -> 67
    const scoredClaims: ScoredClaim[] = [
      makeScoredClaim("claim A", "GREEN", 2 / 3),
    ];
    expect(computeHealthScore(scoredClaims)).toBe(67);
  });
});

// ---------------------------------------------------------------------------
// buildDriftReport
// ---------------------------------------------------------------------------

describe("buildDriftReport", () => {
  it("assembles DriftReport with correct shape", () => {
    const scoredClaims = [makeScoredClaim("uses bun", "GREEN", 0.8)];
    const report = buildDriftReport("CLAUDE.md", scoredClaims);

    expect(report).toEqual<DriftReport>({
      sourceFile: "CLAUDE.md",
      healthScore: 80,
      scoredClaims,
    });
  });

  it("computes health score via computeHealthScore (empty = 100)", () => {
    const report = buildDriftReport("AGENTS.md", []);
    expect(report.healthScore).toBe(100);
    expect(report.scoredClaims).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// renderDriftReport
// ---------------------------------------------------------------------------

describe("renderDriftReport", () => {
  const mixedReport: DriftReport = buildDriftReport("CLAUDE.md", [
    makeScoredClaim("uses TypeScript", "GREEN", 0.80, makeEvidence(0.80)),
    makeScoredClaim("uses Redis for caching", "YELLOW", 0.50, makeEvidence(0.50)),
    makeScoredClaim("uses GraphQL API", "RED", 0.15, makeEvidence(0.15)),
  ]);

  it("includes the # Drift Report header", () => {
    const output = renderDriftReport(mixedReport);
    expect(output).toContain("# Drift Report");
  });

  it("includes the health score", () => {
    const output = renderDriftReport(mixedReport);
    // mean(0.80, 0.50, 0.15) = 0.4833... -> 48
    expect(output).toContain("48/100");
  });

  it("includes the source file name", () => {
    const output = renderDriftReport(mixedReport);
    expect(output).toContain("CLAUDE.md");
  });

  it("includes status group headings", () => {
    const output = renderDriftReport(mixedReport);
    expect(output).toContain("## Confirmed (GREEN)");
    expect(output).toContain("## Possibly Stale (YELLOW)");
    expect(output).toContain("## Contradicted (RED)");
  });

  it("renders each claim with its status tag and score", () => {
    const output = renderDriftReport(mixedReport);
    expect(output).toContain("[GREEN] uses TypeScript (score: 0.80)");
    expect(output).toContain("[YELLOW] uses Redis for caching (score: 0.50)");
    expect(output).toContain("[RED] uses GraphQL API (score: 0.15)");
  });

  it("renders evidence for RED and YELLOW claims", () => {
    const output = renderDriftReport(mixedReport);
    // RED claim evidence
    expect(output).toContain("src/auth.ts");
    expect(output).toContain("src/middleware.ts");
  });

  it("does NOT render evidence indented under GREEN claims", () => {
    const report = buildDriftReport("f.md", [
      makeScoredClaim("uses bun", "GREEN", 0.90, makeEvidence(0.90)),
    ]);
    const output = renderDriftReport(report);
    // GREEN claim line should not be followed by indented evidence
    const lines = output.split("\n");
    const greenLine = lines.findIndex((l) => l.includes("[GREEN]"));
    expect(greenLine).toBeGreaterThan(-1);
    // Next non-empty line after GREEN claim should NOT start with '  -'
    const nextContent = lines.slice(greenLine + 1).find((l) => l.trim() !== "");
    expect(nextContent).not.toMatch(/^\s{2}-/);
  });

  it("includes summary line with counts", () => {
    const output = renderDriftReport(mixedReport);
    expect(output).toContain("Summary:");
    expect(output).toContain("1 confirmed");
    expect(output).toContain("1 possibly stale");
    expect(output).toContain("1 contradicted");
  });

  it("handles a report with only GREEN claims (no YELLOW/RED sections)", () => {
    const report = buildDriftReport("f.md", [
      makeScoredClaim("uses TypeScript", "GREEN", 0.90),
    ]);
    const output = renderDriftReport(report);
    expect(output).toContain("## Confirmed (GREEN)");
    expect(output).not.toContain("## Possibly Stale");
    expect(output).not.toContain("## Contradicted");
    expect(output).toContain("1 confirmed, 0 possibly stale, 0 contradicted");
  });

  it("truncates long evidence chunk previews to 80 chars", () => {
    const longChunk = "x".repeat(200);
    const evidence: SearchResult[] = [
      { file: "src/long.ts", chunk: longChunk, score: 0.30 },
    ];
    const report = buildDriftReport("f.md", [
      makeScoredClaim("some claim", "RED", 0.30, evidence),
    ]);
    const output = renderDriftReport(report);
    const evidenceLine = output.split("\n").find((l) => l.includes("src/long.ts"));
    expect(evidenceLine).toBeDefined();
    // After "src/long.ts: " the chunk should be truncated at 80 chars
    const chunkPart = evidenceLine!.split(": ")[1];
    expect(chunkPart?.length).toBeLessThanOrEqual(80);
  });

  it("renders empty report with health score 100 and no claim sections", () => {
    const report = buildDriftReport("empty.md", []);
    const output = renderDriftReport(report);
    expect(output).toContain("100/100");
    expect(output).toContain("0 confirmed, 0 possibly stale, 0 contradicted");
    expect(output).not.toContain("## Confirmed");
  });
});
