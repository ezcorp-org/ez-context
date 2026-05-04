import path from "node:path";
import ora from "ora";
import chalk from "chalk";
import { extractConventions } from "../core/pipeline.js";
import { emit } from "../emitters/index.js";
import type { EmitOptions, OutputFormat } from "../emitters/types.js";

const DRY_RUN_PREVIEW_LINES = 20;

const VALID_FORMATS: OutputFormat[] = [
  "claude",
  "agents",
  "cursor",
  "copilot",
  "skills",
  "rulesync",
  "ruler",
];

export function parseFormats(raw: string): OutputFormat[] {
  const formats = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  const invalid = formats.filter((f) => !VALID_FORMATS.includes(f as OutputFormat));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid format(s): ${invalid.join(", ")}. Valid: ${VALID_FORMATS.join(", ")}`
    );
  }
  return formats as OutputFormat[];
}

function truncatePreview(content: string): string {
  const lines = content.split("\n");
  if (lines.length <= DRY_RUN_PREVIEW_LINES) {
    return content;
  }
  const preview = lines.slice(0, DRY_RUN_PREVIEW_LINES).join("\n");
  return `${preview}\n... (${lines.length} lines total)`;
}

export async function generateAction(
  pathArg: string,
  options: { dryRun?: boolean; yes?: boolean; output?: string; threshold?: string; format?: string }
): Promise<void> {
  const projectPath = path.resolve(pathArg);

  // --yes and non-TTY environments: ora handles non-TTY gracefully by
  // falling back to plain text. No interactive prompts are used anywhere.
  const spinner = ora("Analyzing project conventions...").start();

  try {
    const registry = await extractConventions(projectPath);
    const conventionCount = registry.conventions.length;
    spinner.succeed(`Found ${conventionCount} convention${conventionCount === 1 ? "" : "s"}`);

    const confidenceThreshold = parseFloat(options.threshold ?? "0.7");
    if (Number.isNaN(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 1) {
      console.error(chalk.red("Invalid --threshold: must be a number between 0 and 1"));
      process.exit(1);
    }
    const outputDir = path.resolve(options.output ?? ".");

    // Parse and validate --format (default: "claude,agents")
    const formats = parseFormats(options.format ?? "claude,agents");

    const emitOptions: EmitOptions = {
      outputDir,
      confidenceThreshold,
      dryRun: options.dryRun ?? false,
      formats,
    };

    const isDefault = formats.length === 2 && formats.includes("claude") && formats.includes("agents");
    const genSpinnerText = isDefault
      ? "Generating context files..."
      : `Generating ${formats.length} context file${formats.length === 1 ? "" : "s"}...`;
    const genSpinner = ora(genSpinnerText).start();
    const result = await emit(registry, emitOptions);

    if (options.dryRun) {
      genSpinner.succeed("Dry run complete");
      console.log();
      console.log(chalk.bold.yellow("╔══════════════════════════════════════╗"));
      console.log(chalk.bold.yellow("║  DRY RUN -- no files will be written ║"));
      console.log(chalk.bold.yellow("╚══════════════════════════════════════╝"));
      console.log();
      for (const [format, content] of Object.entries(result.rendered)) {
        console.log(chalk.cyan(`--- ${format.toUpperCase()} ---`));
        console.log(truncatePreview(content));
        console.log();
      }
    } else {
      genSpinner.succeed(`Generated ${result.filesWritten.length} file${result.filesWritten.length === 1 ? "" : "s"}`);
      console.log();
      console.log(chalk.bold.green("Generated files:"));
      for (const filePath of result.filesWritten) {
        const relPath = path.relative(outputDir, filePath);
        console.log(`  ${chalk.cyan(relPath)}`);
      }
    }
  } catch (err) {
    spinner.fail("Analysis failed");
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    process.exit(1);
  }
}
