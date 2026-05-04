/**
 * Updater — targeted regeneration engine for `ez-context update`.
 *
 * Orchestrates:
 *   1. Marker validation (pre-flight check, markers strategy only)
 *   2. Drift detection (skip GREEN files, markers strategy only)
 *   3. File backup (before any write)
 *   4. Re-rendering (via FORMAT_EMITTER_MAP)
 *   5. Write-back (writeWithMarkers for markers strategy, writeFile for direct)
 */
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { MARKER_START, MARKER_END, writeWithMarkers } from "../emitters/writer.js";
import { FORMAT_EMITTER_MAP } from "../emitters/index.js";
import { extractClaims } from "./drift/claim-extractor.js";
import { scoreClaims } from "./drift/claim-scorer.js";
import type { EzSearchBridge } from "./ez-search-bridge.js";
import type { ConventionRegistry } from "./schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarkerValidation {
  valid: boolean;
  mode: "append" | "splice" | "invalid";
  reason?: string;
  startIdx?: number;
  endIdx?: number;
}

export type UpdateAction = "skipped" | "updated" | "aborted";

export interface FileUpdateResult {
  filePath: string;
  action: UpdateAction;
  reason: string;
  backupPath?: string;
}

// ---------------------------------------------------------------------------
// validateMarkers
// ---------------------------------------------------------------------------

/**
 * Pre-flight marker check for updateFile.
 *
 * Unlike writeWithMarkers (which silently appends on unpaired markers),
 * validateMarkers rejects unpaired markers so updateFile can abort safely.
 *
 * Returns:
 *   - { valid: true, mode: "append" }              — no markers, safe to append
 *   - { valid: true, mode: "splice", startIdx, endIdx } — well-formed pair
 *   - { valid: false, mode: "invalid", reason }    — unpaired or inverted markers
 */
export function validateMarkers(content: string): MarkerValidation {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);

  const hasStart = startIdx !== -1;
  const hasEnd = endIdx !== -1;

  // No markers at all -> safe to append
  if (!hasStart && !hasEnd) {
    return { valid: true, mode: "append" };
  }

  // Both markers present -> validate ordering
  if (hasStart && hasEnd) {
    if (endIdx < startIdx) {
      return {
        valid: false,
        mode: "invalid",
        reason: "End marker appears before start marker (corrupted file)",
      };
    }
    return { valid: true, mode: "splice", startIdx, endIdx };
  }

  // Unpaired: only one marker present
  if (hasStart && !hasEnd) {
    return {
      valid: false,
      mode: "invalid",
      reason: "Unpaired ez-context marker: end marker missing",
    };
  }

  // hasEnd && !hasStart
  return {
    valid: false,
    mode: "invalid",
    reason: "Unpaired ez-context marker: start marker missing",
  };
}

// ---------------------------------------------------------------------------
// backupFile
// ---------------------------------------------------------------------------

/**
 * Copy filePath to filePath.bak and return the backup path.
 * Returns null if the file does not exist.
 * Overwrites any existing .bak silently (represents state before this run).
 */
export async function backupFile(filePath: string): Promise<string | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  const backupPath = filePath + ".bak";
  await copyFile(filePath, backupPath);
  return backupPath;
}

// ---------------------------------------------------------------------------
// findFormatEntry
// ---------------------------------------------------------------------------

/**
 * Look up the FORMAT_EMITTER_MAP entry whose filename suffix matches filePath.
 * Returns undefined if the file doesn't correspond to a known format.
 */
function findFormatEntry(filePath: string) {
  const normalized = path.normalize(filePath);
  for (const entry of Object.values(FORMAT_EMITTER_MAP)) {
    if (normalized.endsWith(path.normalize(entry.filename))) {
      return entry;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// updateFile
// ---------------------------------------------------------------------------

/**
 * Orchestrate drift detection and targeted re-rendering for a single file.
 *
 * The write strategy is determined by FORMAT_EMITTER_MAP:
 *   - "markers" strategy: drift detection + writeWithMarkers (default)
 *   - "direct" strategy:  always regenerate + writeFile (full overwrite)
 *
 * Flow for markers strategy:
 *   1. File existence check — skip if missing
 *   2. Marker validation — abort on invalid markers
 *   3. Drift check (splice mode only) — skip if all claims GREEN
 *   4. Backup creation
 *   5. Re-render + writeWithMarkers
 *
 * Flow for direct strategy:
 *   1. File existence check — skip if missing
 *   2. Backup creation
 *   3. Re-render + writeFile (full overwrite)
 *
 * @param filePath             Absolute path to the context file
 * @param registry             Pre-computed convention registry (NOT extracted per-file)
 * @param bridge               EzSearchBridge instance for drift scoring
 * @param confidenceThreshold  Confidence floor passed to the renderer (default 0.7)
 */
export async function updateFile(
  filePath: string,
  registry: ConventionRegistry,
  bridge: EzSearchBridge,
  confidenceThreshold: number = 0.7
): Promise<FileUpdateResult> {
  // 1. File existence check
  if (!existsSync(filePath)) {
    return { filePath, action: "skipped", reason: "File does not exist" };
  }

  const formatEntry = findFormatEntry(filePath);
  // Fall back to claude (markers) if the file isn't a known format
  const strategy = formatEntry?.strategy ?? "markers";
  const render = formatEntry?.render ?? FORMAT_EMITTER_MAP.claude.render;

  // ---------------------------------------------------------------------------
  // Direct strategy: full regeneration, no drift detection
  // ---------------------------------------------------------------------------
  if (strategy === "direct") {
    const backupPath = (await backupFile(filePath)) ?? undefined;
    const newContent = render(registry, confidenceThreshold);
    await writeFile(filePath, newContent, "utf-8");
    return {
      filePath,
      action: "updated",
      reason: "Re-rendered (direct strategy)",
      backupPath,
    };
  }

  // ---------------------------------------------------------------------------
  // Markers strategy: drift detection + writeWithMarkers
  // ---------------------------------------------------------------------------

  // 2. Read content and validate markers
  const content = await readFile(filePath, "utf-8");
  const validation = validateMarkers(content);

  if (!validation.valid) {
    return { filePath, action: "aborted", reason: validation.reason! };
  }

  // 3. Drift check (only when markers are already present)
  if (validation.mode === "splice") {
    const claims = extractClaims(content, filePath);

    // Nothing to check — skip (no claims extracted means no drift to detect)
    if (claims.length === 0) {
      return { filePath, action: "skipped", reason: "No drift detected" };
    }

    const scored = await scoreClaims(claims, bridge);
    const hasDrift = scored.some((s) => s.status !== "GREEN");

    if (!hasDrift) {
      return { filePath, action: "skipped", reason: "No drift detected" };
    }
  }
  // mode === "append": file has no generated section yet -> always proceed

  // 4. Backup before any write
  const backupPath = (await backupFile(filePath)) ?? undefined;

  // 5. Re-render + write
  const newContent = render(registry, confidenceThreshold);
  await writeWithMarkers(filePath, newContent);

  return {
    filePath,
    action: "updated",
    reason: "Re-rendered drifted sections",
    backupPath,
  };
}
