import { describe, it, expect } from "vitest";
import {
  extractClaims,
  type Claim,
} from "../../../src/core/drift/claim-extractor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function claimTexts(claims: Claim[]): string[] {
  return claims.map((c) => c.text);
}

// ---------------------------------------------------------------------------
// Bullet extraction
// ---------------------------------------------------------------------------

describe("extractClaims - bullet extraction", () => {
  it("extracts dash bullets", () => {
    const content = "- Uses vitest for unit testing";
    const claims = extractClaims(content, "test.md");
    expect(claimTexts(claims)).toEqual(["Uses vitest for unit testing"]);
  });

  it("extracts asterisk bullets", () => {
    const content = "* Uses vitest for unit testing";
    const claims = extractClaims(content, "test.md");
    expect(claimTexts(claims)).toEqual(["Uses vitest for unit testing"]);
  });

  it("extracts plus bullets", () => {
    const content = "+ Uses vitest for unit testing";
    const claims = extractClaims(content, "test.md");
    expect(claimTexts(claims)).toEqual(["Uses vitest for unit testing"]);
  });

  it("extracts multiple bullets", () => {
    const content = [
      "- Uses vitest for unit testing",
      "- Bun is used as the runtime",
      "- TypeScript strict mode enabled",
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claimTexts(claims)).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Numbered list extraction
// ---------------------------------------------------------------------------

describe("extractClaims - numbered list extraction", () => {
  it("extracts numbered list items", () => {
    const content = [
      "1. Use vitest for testing all modules",
      "2. Follow TypeScript strict mode conventions",
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claimTexts(claims)).toEqual([
      "Use vitest for testing all modules",
      "Follow TypeScript strict mode conventions",
    ]);
  });

  it("extracts higher numbered items", () => {
    const content = "10. Run tests before committing changes";
    const claims = extractClaims(content, "test.md");
    expect(claimTexts(claims)).toEqual(["Run tests before committing changes"]);
  });
});

// ---------------------------------------------------------------------------
// Section tracking
// ---------------------------------------------------------------------------

describe("extractClaims - section tracking", () => {
  it("sets sourceSection from H2 heading", () => {
    const content = [
      "## Stack",
      "- Uses vitest for unit testing",
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceSection).toBe("Stack");
  });

  it("sets sourceSection from H1 heading", () => {
    const content = [
      "# Overview",
      "- Runs on bun runtime environment",
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceSection).toBe("Overview");
  });

  it("sets sourceSection from H3 heading", () => {
    const content = [
      "### Testing",
      "- Uses vitest with coverage reports",
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceSection).toBe("Testing");
  });

  it("updates section when heading changes", () => {
    const content = [
      "## Stack",
      "- Uses vitest for unit testing",
      "## Conventions",
      "- TypeScript strict mode is enforced",
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceSection).toBe("Stack");
    expect(claims[1]?.sourceSection).toBe("Conventions");
  });

  it("uses empty string for claims before any heading", () => {
    const content = "- Uses vitest for unit testing";
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceSection).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Line numbers
// ---------------------------------------------------------------------------

describe("extractClaims - line numbers", () => {
  it("records correct 1-based line number for first line", () => {
    const content = "- Uses vitest for unit testing";
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceLine).toBe(1);
  });

  it("records correct 1-based line number with heading", () => {
    const content = [
      "## Stack",           // line 1 — heading, not a claim
      "- Uses vitest for unit testing", // line 2 — claim
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceLine).toBe(2);
  });

  it("records correct line numbers for multiple claims", () => {
    const content = [
      "- Uses vitest for unit testing",  // line 1
      "",                                  // line 2 — blank
      "- Bun is used as the runtime",     // line 3
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.sourceLine).toBe(1);
    expect(claims[1]?.sourceLine).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Length filters
// ---------------------------------------------------------------------------

describe("extractClaims - length filters", () => {
  it("skips claims shorter than 10 chars", () => {
    const content = "- short"; // 5 chars after bullet strip
    const claims = extractClaims(content, "test.md");
    expect(claims).toHaveLength(0);
  });

  it("keeps claims of exactly 10 chars", () => {
    const content = "- 1234567890"; // exactly 10 chars
    const claims = extractClaims(content, "test.md");
    expect(claims).toHaveLength(1);
  });

  it("keeps claims within length bounds", () => {
    const content = "- Long enough text here"; // 19 chars
    const claims = extractClaims(content, "test.md");
    expect(claims).toHaveLength(1);
  });

  it("skips claims longer than 300 chars", () => {
    const longText = "A".repeat(301);
    const content = `- ${longText}`;
    const claims = extractClaims(content, "test.md");
    expect(claims).toHaveLength(0);
  });

  it("keeps claims of exactly 300 chars", () => {
    const text = "A".repeat(300);
    const content = `- ${text}`;
    const claims = extractClaims(content, "test.md");
    expect(claims).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Boilerplate filtering
// ---------------------------------------------------------------------------

describe("extractClaims - boilerplate skip", () => {
  it("skips Language: boilerplate", () => {
    const content = "- Language: TypeScript";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips Framework: boilerplate", () => {
    const content = "- Framework: Express";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips Build: boilerplate", () => {
    const content = "- Build: tsdown";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips Package Manager: boilerplate", () => {
    const content = "- Package Manager: bun";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips Test Runner: boilerplate", () => {
    const content = "- Test Runner: vitest";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips Pattern: boilerplate", () => {
    const content = "- Pattern: repository pattern";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips Layers: boilerplate", () => {
    const content = "- Layers: commands, core, emitters";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips bold variant after stripping: **Language:** TypeScript", () => {
    // After bold stripping: "Language: TypeScript" -> matches BOILERPLATE_VALUE
    const content = "- **Language:** TypeScript";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("does not skip non-boilerplate lines", () => {
    const content = "- Uses vitest for unit testing";
    expect(extractClaims(content, "test.md")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Bold and code marker stripping
// ---------------------------------------------------------------------------

describe("extractClaims - bold/code stripping", () => {
  it("strips bold markers from claim text", () => {
    const content = "- Uses **vitest** for testing";
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.text).toBe("Uses vitest for testing");
  });

  it("strips inline code markers from claim text", () => {
    const content = "- Uses `bun` runtime environment";
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.text).toBe("Uses bun runtime environment");
  });

  it("strips both bold and code in one claim", () => {
    const content = "- Uses **vitest** with `bun` for testing modules";
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.text).toBe("Uses vitest with bun for testing modules");
  });

  it("strips multiple bold occurrences", () => {
    const content = "- **TypeScript** strict mode with **zod** validation";
    const claims = extractClaims(content, "test.md");
    expect(claims[0]?.text).toBe("TypeScript strict mode with zod validation");
  });
});

// ---------------------------------------------------------------------------
// ez-context marker and HTML comment handling
// ---------------------------------------------------------------------------

describe("extractClaims - marker and comment skipping", () => {
  it("skips ez-context start markers", () => {
    const content = "<!-- ez-context:start:stack -->";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips ez-context end markers", () => {
    const content = "<!-- ez-context:end:stack -->";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("skips arbitrary HTML comments", () => {
    const content = "<!-- any comment here -->";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });

  it("does not skip content around markers", () => {
    const content = [
      "<!-- ez-context:start:stack -->",
      "- Uses vitest for unit testing",
      "<!-- ez-context:end:stack -->",
    ].join("\n");
    const claims = extractClaims(content, "test.md");
    expect(claimTexts(claims)).toEqual(["Uses vitest for unit testing"]);
  });
});

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe("extractClaims - empty input", () => {
  it("returns empty array for empty string", () => {
    expect(extractClaims("", "test.md")).toHaveLength(0);
  });

  it("returns empty array for whitespace-only content", () => {
    expect(extractClaims("   \n\n   \n", "test.md")).toHaveLength(0);
  });

  it("returns empty array for headings only", () => {
    const content = "## Stack\n### Testing\n# Overview";
    expect(extractClaims(content, "test.md")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mixed content (realistic CLAUDE.md snippet)
// ---------------------------------------------------------------------------

describe("extractClaims - mixed realistic content", () => {
  it("correctly extracts claims from a realistic CLAUDE.md snippet", () => {
    const content = [
      "<!-- ez-context:start:stack -->",
      "## Stack",
      "",
      "- Language: TypeScript",
      "- Framework: none",
      "- Test Runner: vitest",
      "- Build: tsdown",
      "",
      "<!-- ez-context:end:stack -->",
      "<!-- ez-context:start:conventions -->",
      "## Conventions",
      "",
      "- Use **vitest** for all unit and integration tests",
      "- Prefer `bun` over npm for package management",
      "- All exported functions must have JSDoc comments",
      "- short",              // too short — skipped
      "",
      "<!-- ez-context:end:conventions -->",
      "## Architecture",
      "",
      "1. Commands are thin wrappers over core logic modules",
      "2. All I/O is funneled through adapters for testability",
    ].join("\n");

    const claims = extractClaims(content, "CLAUDE.md");

    // Boilerplate lines: Language, Framework, Test Runner, Build (4 lines) — all skipped
    // Marker comments: 4 lines — skipped
    // Headings: Stack, Conventions, Architecture — skipped
    // "short" — too short, skipped
    // Blank lines — skipped
    // Remaining bullets (3) + numbered items (2) = 5 claims
    expect(claims).toHaveLength(5);

    const texts = claimTexts(claims);
    expect(texts).toContain("Use vitest for all unit and integration tests");
    expect(texts).toContain("Prefer bun over npm for package management");
    expect(texts).toContain("All exported functions must have JSDoc comments");
    expect(texts).toContain("Commands are thin wrappers over core logic modules");
    expect(texts).toContain("All I/O is funneled through adapters for testability");

    // Verify section assignment
    const conventionsClaims = claims.filter(
      (c) => c.sourceSection === "Conventions"
    );
    expect(conventionsClaims).toHaveLength(3);

    const architectureClaims = claims.filter(
      (c) => c.sourceSection === "Architecture"
    );
    expect(architectureClaims).toHaveLength(2);
  });

  it("records sourceFile on all claims", () => {
    const content = "- Uses vitest for all unit tests";
    const claims = extractClaims(content, "CLAUDE.md");
    expect(claims[0]?.sourceFile).toBe("CLAUDE.md");
  });
});
