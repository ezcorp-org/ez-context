/**
 * Distribution verification tests.
 * Validates that package.json is correctly configured for npm publishing
 * and that the standalone binary compiles and responds to basic flags.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGE_JSON_PATH = resolve(ROOT, "package.json");

interface PackageJson {
  name: string;
  version: string;
  publishConfig?: { access?: string };
  files?: string[];
  bin?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

const pkg: PackageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf-8"));

describe("package.json npm distribution config", () => {
  it("publishConfig.access is 'public'", () => {
    expect(pkg.publishConfig).toBeDefined();
    expect(pkg.publishConfig?.access).toBe("public");
  });

  it("files array exists and includes 'dist/'", () => {
    expect(pkg.files).toBeDefined();
    expect(Array.isArray(pkg.files)).toBe(true);
    expect(pkg.files).toContain("dist/");
  });

  it("files array does NOT include 'src/' or 'test/'", () => {
    const files = pkg.files ?? [];
    expect(files).not.toContain("src/");
    expect(files).not.toContain("test/");
    // Also check for partial matches
    const hasSrc = files.some((f) => f === "src" || f.startsWith("src/"));
    const hasTest = files.some((f) => f === "test" || f.startsWith("test/"));
    expect(hasSrc).toBe(false);
    expect(hasTest).toBe(false);
  });

  it("bin field points to dist/cli.js", () => {
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin?.["ez-context"]).toBe("./dist/cli.js");
  });

  it("version is valid semver", () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("compile script exists and uses bun build --compile", () => {
    const compile = pkg.scripts?.compile;
    expect(compile).toBeDefined();
    expect(compile).toContain("bun build");
    expect(compile).toContain("--compile");
  });
});

describe("standalone binary compilation and execution", () => {
  const BINARY_PATH = resolve(ROOT, "dist/ez-context");

  beforeAll(() => {
    // Compile the binary before tests run
    execSync("bun run compile", { cwd: ROOT, stdio: "pipe" });
  }, 60_000);

  it("dist/ez-context binary exists after compilation", () => {
    expect(existsSync(BINARY_PATH)).toBe(true);
  });

  it("--version exits with code 0 and outputs a version string", () => {
    const result = execSync(`${BINARY_PATH} --version`, {
      cwd: ROOT,
      encoding: "utf-8",
    }).trim();
    expect(result).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("--help exits with code 0 and contains 'ez-context'", () => {
    const result = execSync(`${BINARY_PATH} --help`, {
      cwd: ROOT,
      encoding: "utf-8",
    }).trim();
    expect(result).toContain("ez-context");
  });
}, 60_000);
