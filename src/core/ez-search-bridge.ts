/**
 * ez-search bridge — thin adapter over @ez-corp/ez-search.
 *
 * This is the ONLY file that imports from @ez-corp/ez-search.
 * All other modules interact with ez-search via the EzSearchBridge interface.
 */
import { index, query, EzSearchError } from "@ez-corp/ez-search";
import { existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export interface SearchResult {
  file: string;
  chunk: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Bridge interface
// ---------------------------------------------------------------------------

export interface EzSearchBridge {
  /**
   * Returns true if an .ez-search/ index exists for the project directory.
   */
  hasIndex(projectPath: string): Promise<boolean>;

  /**
   * Ensures an index exists: indexes the project if no index is present (EXTR-10).
   */
  ensureIndex(projectPath: string): Promise<void>;

  /**
   * Unconditionally re-indexes the project so search results reflect current file state.
   */
  refreshIndex(projectPath: string): Promise<void>;

  /**
   * Semantic (and hybrid) search over the indexed project.
   */
  search(query: string, options?: { k?: number }): Promise<SearchResult[]>;

  /**
   * Get an embedding vector for the given text.
   * NOTE: @ez-corp/ez-search does not expose a standalone embed API.
   * This method is reserved for future use or a companion embedder.
   */
  embed(text: string): Promise<number[]>;
}

// ---------------------------------------------------------------------------
// Index corruption detection
// ---------------------------------------------------------------------------

/**
 * Check if a .ez-search/ index directory appears corrupt.
 *
 * Zvec (the native vector DB) will SIGABRT if it opens a collection with
 * corrupt .proxima files. Since SIGABRT kills the process before JS can
 * catch, we proactively detect corruption and wipe the index so it can
 * be rebuilt cleanly.
 *
 * Heuristic: a segment directory containing a .proxima file alongside a
 * zero-byte .ipc file indicates an interrupted or corrupt write.
 */
export function isIndexCorrupt(indexDir: string): boolean {
  let entries: string[];
  try {
    entries = readdirSync(indexDir);
  } catch {
    return false;
  }

  for (const entry of entries) {
    // Collection dirs are named like col-512, col-768
    if (!entry.startsWith("col-")) continue;
    const colDir = join(indexDir, entry);

    let segments: string[];
    try {
      segments = readdirSync(colDir);
    } catch {
      continue;
    }

    for (const seg of segments) {
      const segPath = join(colDir, seg);
      try {
        if (!statSync(segPath).isDirectory()) continue;
      } catch {
        continue;
      }

      let files: string[];
      try {
        files = readdirSync(segPath);
      } catch {
        continue;
      }

      const hasProxima = files.some((f) => f.endsWith(".proxima"));
      const hasZeroByteIpc = files.some((f) => {
        if (!f.endsWith(".ipc")) return false;
        try {
          return statSync(join(segPath, f)).size === 0;
        } catch {
          return false;
        }
      });

      if (hasProxima && hasZeroByteIpc) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

class EzSearchBridgeImpl implements EzSearchBridge {
  constructor(private readonly projectPath: string) {}

  async hasIndex(projectPath: string): Promise<boolean> {
    const indexDir = join(projectPath, ".ez-search");
    return existsSync(indexDir);
  }

  async ensureIndex(projectPath: string): Promise<void> {
    if (await this.hasIndex(projectPath)) {
      return;
    }
    await index(projectPath);
  }

  async refreshIndex(projectPath: string): Promise<void> {
    const indexDir = join(projectPath, ".ez-search");

    // Proactively wipe corrupt indexes to prevent Zvec native SIGABRT
    if (existsSync(indexDir) && isIndexCorrupt(indexDir)) {
      rmSync(indexDir, { recursive: true, force: true });
    }

    // Incremental: ez-search >=1.3.3 skips unchanged files (mtime+size+hash),
    // only re-embeds modified chunks, and auto-recovers from stale Zvec locks.
    try {
      await index(projectPath);
    } catch (err) {
      // Index may be partially corrupt in a way we didn't detect — wipe and retry once
      if (existsSync(indexDir)) {
        rmSync(indexDir, { recursive: true, force: true });
        await index(projectPath);
      } else {
        throw err;
      }
    }
  }

  async search(
    searchQuery: string,
    options: { k?: number } = {}
  ): Promise<SearchResult[]> {
    const { k = 10 } = options;

    let raw: Awaited<ReturnType<typeof query>>;
    try {
      raw = await query(searchQuery, {
        topK: k,
        projectDir: this.projectPath,
        autoIndex: false,
      });
    } catch (err: unknown) {
      if (err instanceof EzSearchError && err.code === "NO_INDEX") {
        return [];
      }
      throw err;
    }

    const results: SearchResult[] = [];

    for (const hit of raw.code) {
      results.push({ file: hit.file, chunk: hit.text, score: hit.score });
    }
    for (const hit of raw.text) {
      results.push({ file: hit.file, chunk: hit.text, score: hit.score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  async embed(_text: string): Promise<number[]> {
    // @ez-corp/ez-search does not expose a standalone embed endpoint.
    // This is a planned capability that will be implemented when a
    // companion embedding API becomes available.
    throw new Error(
      "embed() is not yet supported by the ez-search bridge. " +
        "Use search() for semantic retrieval."
    );
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an EzSearchBridge bound to the given project directory.
 */
export async function createBridge(
  projectPath: string
): Promise<EzSearchBridge> {
  return new EzSearchBridgeImpl(projectPath);
}
