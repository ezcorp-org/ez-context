/**
 * Claim extractor — parses markdown context files into individual testable claims.
 *
 * Input: raw markdown string (CLAUDE.md, AGENTS.md, .cursorrules, etc.)
 * Output: Claim[] where each claim is an atomic declarative statement
 *
 * Extraction rules:
 *   - Bullet points: ^[-*+]\s+
 *   - Numbered list items: ^\d+\.\s+
 *   - Bold/code markers stripped from extracted text
 *   - Boilerplate value lines skipped (Language: X, Framework: X, etc.)
 *   - ez-context markers and HTML comments skipped
 *   - Claims shorter than 10 chars or longer than 300 chars excluded
 *   - Current section heading tracked for context
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Claim {
  text: string;          // The claim text (bold/code markers stripped)
  sourceFile: string;    // Which file it came from
  sourceLine: number;    // 1-based line number
  sourceSection: string; // Nearest parent heading
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * Matches boilerplate key-value lines that are structural metadata, not
 * behavioral claims. Applied AFTER bold/code stripping.
 *
 * Examples skipped:
 *   "Language: TypeScript"
 *   "Package Manager: bun"
 */
const BOILERPLATE_VALUE =
  /^(Language|Framework|Build|Package Manager|Test Runner|Pattern|Layers):\s/i;

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Extract all testable claims from a markdown string.
 *
 * @param content   Raw markdown content of the context file
 * @param sourceFile Path to the source file (stored on each claim)
 * @returns Array of extracted claims, filtered and deduplicated
 */
export function extractClaims(content: string, sourceFile: string): Claim[] {
  const claims: Claim[] = [];
  const lines = content.split("\n");
  let currentSection = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const lineNum = i + 1; // 1-based

    // Skip blank lines
    if (!line) continue;

    // Skip HTML comments (includes ez-context markers like <!-- ez-context:... -->)
    if (line.startsWith("<!--")) continue;

    // Skip lines containing ez-context markers (belt-and-suspenders for inline markers)
    if (line.includes("ez-context:")) continue;

    // Track section headings — H1, H2, H3
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) {
      currentSection = heading[1]!.trim();
      continue;
    }

    // Match bullet points or numbered list items
    const bullet = line.match(/^[-*+]\s+(.+)/);
    const numbered = !bullet ? line.match(/^\d+\.\s+(.+)/) : null;
    const rawText = bullet ? bullet[1]! : numbered ? numbered[1]! : null;

    if (!rawText) continue;

    // Strip bold markers (**text** -> text) and inline code markers (`text` -> text)
    const text = rawText
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trim();

    // Apply length filters
    if (text.length < 10 || text.length > 300) continue;

    // Skip boilerplate key-value lines
    if (BOILERPLATE_VALUE.test(text)) continue;

    claims.push({
      text,
      sourceFile,
      sourceLine: lineNum,
      sourceSection: currentSection,
    });
  }

  return claims;
}
