import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { ConventionEntry } from "../../core/schema.js";
import type { Extractor, ExtractionContext } from "../types.js";

type Entry = Omit<ConventionEntry, "id">;

type CargoToml = {
  package?: { name?: string; version?: string };
  dependencies?: Record<string, unknown>;
  [key: string]: unknown;
};

export const cargoTomlExtractor: Extractor = {
  name: "cargo-toml",

  async extract(ctx: ExtractionContext): Promise<Entry[]> {
    const filePath = join(ctx.projectPath, "Cargo.toml");

    try {
      await access(filePath);
    } catch {
      return [];
    }

    let cargo: CargoToml;
    try {
      const raw = await readFile(filePath, "utf-8");
      cargo = parseToml(raw) as CargoToml;
    } catch {
      return [];
    }

    const packageName = cargo.package?.name;
    if (!packageName) {
      return [];
    }

    const dependencyCount = Object.keys(cargo.dependencies ?? {}).length;

    return [
      {
        category: "stack",
        pattern: `Rust project (${packageName})`,
        confidence: 1.0,
        evidence: [{ file: "Cargo.toml", line: null }],
        metadata: {
          language: "Rust",
          packageName,
          dependencyCount,
        },
      },
    ];
  },
};
