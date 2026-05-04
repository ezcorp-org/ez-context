/**
 * Claim scorer — compares extracted claims against the code index via semantic search.
 *
 * Each claim is searched against the indexed codebase. The top similarity score
 * determines whether the claim is GREEN (well-supported), YELLOW (possibly stale),
 * or RED (contradicted / not found).
 *
 * Claims are processed in batches to avoid ONNX pipeline contention.
 */
import type { Claim } from "./claim-extractor.js";
import type { SearchResult, EzSearchBridge } from "../ez-search-bridge.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const GREEN_THRESHOLD = 0.65;
export const YELLOW_THRESHOLD = 0.40;
export const BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClaimStatus = "GREEN" | "YELLOW" | "RED";

export interface ScoredClaim {
  claim: Claim;
  status: ClaimStatus;
  score: number;           // Top bridge.search() score (0.0-1.0)
  evidence: SearchResult[]; // Top k results
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function classifyScore(score: number): ClaimStatus {
  if (score >= GREEN_THRESHOLD) return "GREEN";
  if (score >= YELLOW_THRESHOLD) return "YELLOW";
  return "RED";
}

async function scoreSingleClaim(
  claim: Claim,
  bridge: EzSearchBridge
): Promise<ScoredClaim> {
  const evidence = await bridge.search(claim.text, { k: 5 });
  const topScore = evidence.length > 0 ? evidence[0]!.score : 0;
  return {
    claim,
    status: classifyScore(topScore),
    score: topScore,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score all claims by searching the code index in batches of BATCH_SIZE.
 *
 * @param claims     Claims to score
 * @param bridge     EzSearchBridge instance bound to the project
 * @param onProgress Optional callback fired after each batch: (done, total)
 * @returns          ScoredClaim[] in the same order as input claims
 */
export async function scoreClaims(
  claims: Claim[],
  bridge: EzSearchBridge,
  onProgress?: (completed: number, total: number) => void
): Promise<ScoredClaim[]> {
  const total = claims.length;
  const batches = chunk(claims, BATCH_SIZE);
  const results: ScoredClaim[] = [];
  let completed = 0;

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map((claim) => scoreSingleClaim(claim, bridge))
    );
    results.push(...batchResults);
    completed += batch.length;
    onProgress?.(completed, total);
  }

  return results;
}
