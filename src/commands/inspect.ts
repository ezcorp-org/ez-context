import path from "node:path";
import ora from "ora";
import chalk from "chalk";
import { extractConventions } from "../core/pipeline.js";
import type { ConventionEntry } from "../core/schema.js";

function confidenceDot(confidence: number): string {
  if (confidence >= 0.8) return chalk.green("●");
  if (confidence >= 0.6) return chalk.yellow("●");
  return chalk.red("●");
}

export async function inspectAction(
  pathArg: string,
  options: { threshold?: string }
): Promise<void> {
  const projectPath = path.resolve(pathArg);
  const spinner = ora("Analyzing project conventions...").start();

  try {
    const registry = await extractConventions(projectPath);
    const totalCount = registry.conventions.length;
    spinner.succeed(`Extracted ${totalCount} convention${totalCount === 1 ? "" : "s"}`);

    const threshold = parseFloat(options.threshold ?? "0.7");
    if (Number.isNaN(threshold) || threshold < 0 || threshold > 1) {
      console.error(chalk.red("Invalid --threshold: must be a number between 0 and 1"));
      process.exit(1);
    }

    const filtered = registry.conventions.filter(
      (c) => c.confidence >= threshold
    );

    if (filtered.length === 0) {
      console.log(
        chalk.yellow(
          `\nNo conventions found above ${threshold} confidence threshold. Try lowering --threshold.`
        )
      );
      return;
    }

    // Group by category
    const byCategory = new Map<string, ConventionEntry[]>();
    for (const convention of filtered) {
      const group = byCategory.get(convention.category) ?? [];
      group.push(convention);
      byCategory.set(convention.category, group);
    }

    console.log();
    for (const [category, conventions] of byCategory) {
      console.log(chalk.bold(category.toUpperCase()));
      for (const convention of conventions) {
        const pct = Math.round(convention.confidence * 100);
        console.log(
          `  ${confidenceDot(convention.confidence)} ${convention.pattern} ${chalk.gray(`(${pct}%)`)}`
        );
      }
      console.log();
    }

    const categoryCount = byCategory.size;
    console.log(
      chalk.gray(
        `Found ${filtered.length} convention${filtered.length === 1 ? "" : "s"} across ${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} (threshold: ${threshold})`
      )
    );
  } catch (err) {
    spinner.fail("Analysis failed");
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
