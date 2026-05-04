import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cargoTomlExtractor } from "../../../src/extractors/static/cargo-toml.js";

describe("cargoTomlExtractor", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "ez-cargo-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("extracts package name and dependency count", async () => {
    const toml = `[package]
name = "my-app"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }
anyhow = "1.0"
`;
    await writeFile(join(tempDir, "Cargo.toml"), toml);

    const entries = await cargoTomlExtractor.extract({ projectPath: tempDir });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.category).toBe("stack");
    expect(entries[0]!.pattern).toContain("my-app");
    expect(entries[0]!.confidence).toBe(1.0);
    expect(entries[0]!.metadata?.language).toBe("Rust");
    expect(entries[0]!.metadata?.packageName).toBe("my-app");
    expect(entries[0]!.metadata?.dependencyCount).toBe(3);
    expect(entries[0]!.evidence).toEqual([{ file: "Cargo.toml", line: null }]);
  });

  it("handles zero dependencies", async () => {
    const toml = `[package]
name = "hello-world"
version = "0.1.0"
`;
    await writeFile(join(tempDir, "Cargo.toml"), toml);

    const entries = await cargoTomlExtractor.extract({ projectPath: tempDir });

    expect(entries).toHaveLength(1);
    expect(entries[0]!.metadata?.dependencyCount).toBe(0);
  });

  it("returns [] when Cargo.toml is missing", async () => {
    const entries = await cargoTomlExtractor.extract({ projectPath: tempDir });
    expect(entries).toEqual([]);
  });

  it("returns [] for malformed TOML", async () => {
    await writeFile(join(tempDir, "Cargo.toml"), "[[invalid\nname = ");

    const entries = await cargoTomlExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });

  it("returns [] when package name is missing", async () => {
    const toml = `[package]
version = "0.1.0"
`;
    await writeFile(join(tempDir, "Cargo.toml"), toml);

    const entries = await cargoTomlExtractor.extract({ projectPath: tempDir });

    expect(entries).toEqual([]);
  });
});
