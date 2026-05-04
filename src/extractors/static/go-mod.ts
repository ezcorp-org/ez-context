import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

type Entry = Omit<ConventionEntry, "id">;

export const goModExtractor: Extractor = {
  name: "go-mod",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const filePath = join(ctx.projectPath, "go.mod");

    try {
      await access(filePath);
    } catch {
      return [];
    }

    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      return [];
    }

    const lines = raw.split("\n");

    let moduleName = "";
    let goVersion = "";
    let dependencyCount = 0;
    let inRequireBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!moduleName) {
        const moduleMatch = trimmed.match(/^module\s+(\S+)/);
        if (moduleMatch?.[1]) {
          moduleName = moduleMatch[1];
          continue;
        }
      }

      if (!goVersion) {
        const goMatch = trimmed.match(/^go\s+(\S+)/);
        if (goMatch?.[1]) {
          goVersion = goMatch[1];
          continue;
        }
      }

      // Count deps in require blocks
      if (trimmed === "require (") {
        inRequireBlock = true;
        continue;
      }
      if (inRequireBlock) {
        if (trimmed === ")") {
          inRequireBlock = false;
        } else if (trimmed.length > 0 && !trimmed.startsWith("//")) {
          dependencyCount++;
        }
        continue;
      }
      // Single-line require
      if (trimmed.match(/^require\s+\S+\s+v\S+/)) {
        dependencyCount++;
      }
    }

    if (!moduleName) {
      return [];
    }

    return [
      {
        category: "stack",
        pattern: `Go project (${moduleName})`,
        confidence: 1.0,
        evidence: [{ file: "go.mod", line: null }],
        metadata: {
          language: "Go",
          moduleName,
          goVersion: goVersion || null,
          dependencyCount,
        },
      },
    ];
  },
};
