import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import ora from "ora";
import chalk from "chalk";
import { createBridge } from "../core/ez-search-bridge.js";
import { extractClaims } from "../core/drift/claim-extractor.js";
import { scoreClaims } from "../core/drift/claim-scorer.js";
import { buildDriftReport, renderDriftReport, computeHealthScore } from "../core/drift/report.js";

const CANDIDATE_FILES = ["CLAUDE.md", "AGENTS.md", ".cursorrules", "CONTEXT.md"];

function healthColor(score: number): string {
  if (score >= 70) return chalk.green(String(score));
  if (score >= 40) return chalk.yellow(String(score));
  return chalk.red(String(score));
}

export async function driftAction(
  pathArg: string,
  options: { file?: string }
): Promise<void> {
  const projectPath = path.resolve(pathArg);
  const spinner = ora("Loading context files...").start();

  try {
    const bridge = await createBridge(projectPath);

    // Always refresh so search results reflect current file state
    spinner.text = "Refreshing search index...";
    await bridge.refreshIndex(projectPath);
    spinner.text = "Loading context files...";

    // Resolve files
    let filePaths: string[];
    if (options.file) {
      filePaths = [path.resolve(projectPath, options.file)];
    } else {
      filePaths = CANDIDATE_FILES
        .map((name) => path.join(projectPath, name))
        .filter((p) => existsSync(p));
    }

    if (filePaths.length === 0) {
      spinner.fail("No context files found");
      console.error(
        chalk.red("No CLAUDE.md, AGENTS.md, .cursorrules, or CONTEXT.md found. Use --file to specify one.")
      );
      process.exit(1);
    }

    // Extract claims from each file
    const claimsByFile: Map<string, ReturnType<typeof extractClaims>> = new Map();
    for (const filePath of filePaths) {
      const content = await readFile(filePath, "utf-8");
      const claims = extractClaims(content, filePath);
      claimsByFile.set(filePath, claims);
    }

    const allClaims = [...claimsByFile.values()].flat();
    spinner.text = `Analyzing ${allClaims.length} claims...`;

    // Score claims with progress callback
    const scoredAll = await scoreClaims(allClaims, bridge, (done, total) => {
      spinner.text = `Checking claim ${done}/${total}...`;
    });

    // Build and render reports per file
    const reports = filePaths.map((filePath) => {
      const fileClaims = claimsByFile.get(filePath) ?? [];
      const fileScoredClaims = scoredAll.filter((sc) =>
        fileClaims.some((c) => c === sc.claim)
      );
      return buildDriftReport(filePath, fileScoredClaims);
    });

    const overallScore = computeHealthScore(scoredAll);
    spinner.succeed(`Drift analysis complete — health score: ${healthColor(overallScore)}/100`);

    console.log();
    for (const report of reports) {
      console.log(renderDriftReport(report));
      console.log();
    }
  } catch (err) {
    spinner.fail("Drift analysis failed");
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    if (message.includes("index") || message.includes("embedding") || message.includes("vector")) {
      console.error(chalk.yellow("Hint: try deleting .ez-search/ and running again."));
    }
    process.exit(1);
  }
}
