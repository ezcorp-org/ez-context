import { afterEach, describe, expect, it } from "vitest";
import { readFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import path from "node:path";
import { writeWithMarkers, MARKER_START, MARKER_END } from "../../src/emitters/writer.js";

function tmpFile(): string {
  return path.join(os.tmpdir(), `ez-context-test-${crypto.randomUUID()}.md`);
}

describe("writeWithMarkers", () => {
  const files: string[] = [];

  function track(filePath: string): string {
    files.push(filePath);
    return filePath;
  }

  afterEach(async () => {
    for (const f of files) {
      if (existsSync(f)) await unlink(f);
    }
    files.length = 0;
  });

  it("creates new file with markers when file does not exist", async () => {
    const filePath = track(tmpFile());
    await writeWithMarkers(filePath, "hello world");

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain(MARKER_START);
    expect(content).toContain(MARKER_END);
    expect(content).toContain("hello world");
    // markers must wrap content
    expect(content.indexOf(MARKER_START)).toBeLessThan(content.indexOf("hello world"));
    expect(content.indexOf("hello world")).toBeLessThan(content.indexOf(MARKER_END));
  });

  it("replaces content between markers, preserving content outside", async () => {
    const filePath = track(tmpFile());
    const initial = `# My Docs\n\n${MARKER_START}\nold content\n${MARKER_END}\n\n## Extras\n`;
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(filePath, initial, "utf-8")
    );

    await writeWithMarkers(filePath, "new content");

    const result = await readFile(filePath, "utf-8");
    // Old content replaced
    expect(result).not.toContain("old content");
    expect(result).toContain("new content");
    // Content outside markers preserved
    expect(result).toContain("# My Docs");
    expect(result).toContain("## Extras");
    // Still has markers
    expect(result).toContain(MARKER_START);
    expect(result).toContain(MARKER_END);
  });

  it("appends marker section when existing file has no markers", async () => {
    const filePath = track(tmpFile());
    const existing = "# Existing Content\n\nSome text here.\n";
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(filePath, existing, "utf-8")
    );

    await writeWithMarkers(filePath, "generated section");

    const result = await readFile(filePath, "utf-8");
    // Original content preserved
    expect(result).toContain("# Existing Content");
    expect(result).toContain("Some text here.");
    // Appended section contains markers and new content
    expect(result).toContain(MARKER_START);
    expect(result).toContain(MARKER_END);
    expect(result).toContain("generated section");
    // Original content comes before marker section
    expect(result.indexOf("# Existing Content")).toBeLessThan(result.indexOf(MARKER_START));
  });

  it("treats file with only start marker (no end) as no-markers and appends", async () => {
    const filePath = track(tmpFile());
    const broken = `# Partial\n\n${MARKER_START}\norphaned start\n`;
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(filePath, broken, "utf-8")
    );

    await writeWithMarkers(filePath, "appended content");

    const result = await readFile(filePath, "utf-8");
    // Original content preserved (not spliced)
    expect(result).toContain("# Partial");
    expect(result).toContain("orphaned start");
    // New section appended with both markers present
    expect(result).toContain("appended content");
    // Both markers must appear (the new end marker from appended section)
    expect(result).toContain(MARKER_END);
  });
});
