import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import ora from "ora";
import chalk from "chalk";
import { createBridge } from "../core/ez-search-bridge.js";
import { extractConventions } from "../core/pipeline.js";
import { updateFile } from "../core/updater.js";
import { extractClaims } from "../core/drift/claim-extractor.js";
import { scoreClaims } from "../core/drift/claim-scorer.js";
import { FORMAT_EMITTER_MAP } from "../emitters/index.js";

export async function updateAction(
  pathArg: string,
  options: { file?: string; dryRun?: boolean; yes?: boolean }
): Promise<void> {
  const projectPath = path.resolve(pathArg);
  const spinner = ora("Checking for drift...").start();

  try {
    const bridge = await createBridge(projectPath);

    // Always refresh so search results reflect current file state
    spinner.text = "Refreshing search index...";
    await bridge.refreshIndex(projectPath);

    // Resolve target files
    let filePaths: string[];
    if (options.file) {
      filePaths = [path.resolve(projectPath, options.file)];
    } else {
      filePaths = Object.values(FORMAT_EMITTER_MAP)
        .map((entry) => path.join(projectPath, entry.filename))
        .filter((p) => existsSync(p));
    }

    if (filePaths.length === 0) {
      spinner.fail("No context files found");
      console.error(
        chalk.red("No generated context files found. Run 'ez-context generate' first, or use --file to specify one.")
      );
      process.exit(1);
    }

    if (options.dryRun) {
      // Dry-run: analyze drift per file without writing
      spinner.succeed("Dry run complete");
      console.log();
      console.log(chalk.bold.yellow("╔══════════════════════════════════════╗"));
      console.log(chalk.bold.yellow("║  DRY RUN -- no files will be written ║"));
      console.log(chalk.bold.yellow("╚══════════════════════════════════════╝"));
      console.log();

      for (const filePath of filePaths) {
        const basename = path.basename(filePath);
        const content = await readFile(filePath, "utf-8");
        const claims = extractClaims(content, filePath);

        if (claims.length === 0) {
          console.log(`  ${chalk.gray("-")} ${basename} ${chalk.gray("(no claims to check)")}`);
          continue;
        }

        const scored = await scoreClaims(claims, bridge);
        const hasDrift = scored.some((s) => s.status !== "GREEN");

        if (hasDrift) {
          console.log(`  ${chalk.yellow("~")} Would update ${chalk.cyan(basename)}`);
        } else {
          console.log(`  ${chalk.gray("-")} Up to date: ${chalk.gray(basename)}`);
        }
      }

      return;
    }

    // Real update: process each file
    spinner.text = "Extracting conventions...";
    const registry = await extractConventions(projectPath);
    const results = [];
    for (const filePath of filePaths) {
      const basename = path.basename(filePath);
      spinner.text = `Updating ${basename}...`;
      const result = await updateFile(filePath, registry, bridge);
      results.push(result);
    }

    // Summarize results
    const updated = results.filter((r) => r.action === "updated");
    const aborted = results.filter((r) => r.action === "aborted");

    if (updated.length === 0 && aborted.length === 0) {
      spinner.succeed("All context files are up to date");
    } else if (updated.length > 0) {
      spinner.succeed(
        `Updated ${updated.length} file${updated.length === 1 ? "" : "s"}`
      );
    } else {
      spinner.fail("Update incomplete — some files could not be updated");
    }

    // Per-file report
    console.log();
    for (const result of results) {
      const basename = path.basename(result.filePath);
      if (result.action === "updated") {
        const backup = result.backupPath ? ` (backup: ${path.basename(result.backupPath)})` : "";
        console.log(`  ${chalk.green("✓")} ${chalk.cyan(basename)}${chalk.gray(backup)}`);
      } else if (result.action === "skipped") {
        console.log(`  ${chalk.gray("-")} ${chalk.gray(basename)} ${chalk.gray(`(${result.reason})`)}`);
      } else {
        // aborted
        console.log(`  ${chalk.yellow("⚠")} ${chalk.yellow(basename)} ${chalk.yellow(`(${result.reason})`)}`);
      }
    }

    if (aborted.length > 0) {
      console.log();
      console.log(
        chalk.yellow(`Warning: ${aborted.length} file${aborted.length === 1 ? "" : "s"} could not be updated due to marker issues.`)
      );
    }

  } catch (err) {
    spinner.fail("Update failed");
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(message));
    if (message.includes("index") || message.includes("embedding") || message.includes("vector")) {
      console.error(chalk.yellow("Hint: try deleting .ez-search/ and running again."));
    }
    process.exit(1);
  }
}
