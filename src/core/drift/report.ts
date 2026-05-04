/**
 * Drift report — aggregates scored claims into a health score and markdown report.
 *
 * Health score: mean of per-claim scores scaled 0-100 (rounded).
 * Zero claims yields a health score of 100 (nothing to contradict = healthy).
 *
 * Rendered markdown groups claims by status with evidence for stale/contradicted claims.
 */
import type { ScoredClaim } from "./claim-scorer.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriftReport {
  sourceFile: string;
  healthScore: number;
  scoredClaims: ScoredClaim[];
}

// ---------------------------------------------------------------------------
// Health score
// ---------------------------------------------------------------------------

/**
 * Compute the aggregate health score for a set of scored claims.
 * Returns 100 for empty input (no claims = no drift).
 */
export function computeHealthScore(scoredClaims: ScoredClaim[]): number {
  if (scoredClaims.length === 0) return 100;
  const mean =
    scoredClaims.reduce((sum, sc) => sum + sc.score, 0) / scoredClaims.length;
  return Math.round(mean * 100);
}

// ---------------------------------------------------------------------------
// Report assembly
// ---------------------------------------------------------------------------

/**
 * Build a DriftReport from a source file path and its scored claims.
 */
export function buildDriftReport(
  sourceFile: string,
  scoredClaims: ScoredClaim[]
): DriftReport {
  return {
    sourceFile,
    healthScore: computeHealthScore(scoredClaims),
    scoredClaims,
  };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  GREEN: "Confirmed",
  YELLOW: "Possibly Stale",
  RED: "Contradicted",
};

/**
 * Render a drift report as a readable markdown string.
 *
 * Layout:
 *   # Drift Report
 *   Health score, source file, claim count
 *
 *   ## Confirmed (GREEN)
 *   - [GREEN] claim text (score: X.XX)
 *
 *   ## Possibly Stale (YELLOW)
 *   - [YELLOW] claim text (score: X.XX)
 *     - file: chunk_preview
 *
 *   ## Contradicted (RED)
 *   - [RED] claim text (score: X.XX)
 *     - file: chunk_preview
 *
 *   Summary: X confirmed, Y possibly stale, Z contradicted
 */
export function renderDriftReport(report: DriftReport): string {
  const { sourceFile, healthScore, scoredClaims } = report;
  const lines: string[] = [];

  const green = scoredClaims.filter((sc) => sc.status === "GREEN");
  const yellow = scoredClaims.filter((sc) => sc.status === "YELLOW");
  const red = scoredClaims.filter((sc) => sc.status === "RED");

  // Header
  lines.push("# Drift Report");
  lines.push("");
  lines.push(`**Health Score:** ${healthScore}/100`);
  lines.push(`**File:** ${sourceFile}`);
  lines.push(`**Claims:** ${scoredClaims.length}`);
  lines.push("");

  // Render a group of claims
  const renderGroup = (group: ScoredClaim[], status: string) => {
    if (group.length === 0) return;
    const label = STATUS_LABEL[status] ?? status;
    lines.push(`## ${label} (${status})`);
    lines.push("");
    for (const sc of group) {
      lines.push(`- [${sc.status}] ${sc.claim.text} (score: ${sc.score.toFixed(2)})`);
      // Show top 2 evidence items for non-GREEN claims
      if (sc.status !== "GREEN") {
        const topEvidence = sc.evidence.slice(0, 2);
        for (const ev of topEvidence) {
          const preview = ev.chunk.replace(/\s+/g, " ").trim().slice(0, 80);
          lines.push(`  - ${ev.file}: ${preview}`);
        }
      }
    }
    lines.push("");
  };

  renderGroup(green, "GREEN");
  renderGroup(yellow, "YELLOW");
  renderGroup(red, "RED");

  // Summary
  lines.push(
    `Summary: ${green.length} confirmed, ${yellow.length} possibly stale, ${red.length} contradicted`
  );

  return lines.join("\n");
}
