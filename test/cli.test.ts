/**
 * CLI entry point tests.
 * Verifies that the CLI responds correctly to flags and unknown commands.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));

function runCli(args: string[]): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync("npx", ["tsx", "src/cli.ts", ...args], {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    const output = (e.stdout ?? "") + (e.stderr ?? "");
    return { stdout: output.trim(), exitCode: e.status ?? 1 };
  }
}

describe("CLI entry point", () => {
  it("--help shows help text with all command names", () => {
    const { stdout, exitCode } = runCli(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("generate");
    expect(stdout).toContain("inspect");
    expect(stdout).toContain("drift");
    expect(stdout).toContain("update");
  });

  it("--version outputs the version from package.json", () => {
    const { stdout, exitCode } = runCli(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(pkg.version);
  });

  it("exits with error for unknown commands", () => {
    const { stdout, exitCode } = runCli(["nonexistent-command"]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("unknown command");
  });
});
