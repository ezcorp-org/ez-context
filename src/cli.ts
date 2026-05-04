#!/usr/bin/env node
import { Command } from "commander";
import { generateAction } from "./commands/generate.js";
import { inspectAction } from "./commands/inspect.js";
import { driftAction } from "./commands/drift.js";
import { updateAction } from "./commands/update.js";
import pkg from "../package.json" with { type: "json" };

const program = new Command();

program
  .name("ez-context")
  .description("Generate AI context files from any project")
  .version(pkg.version);

program
  .command("generate")
  .description("Extract conventions and generate context files")
  .argument("[path]", "project root to analyze", ".")
  .option("--dry-run", "preview without writing files")
  .option("-y, --yes", "non-interactive mode")
  .option("--output <dir>", "output directory", ".")
  .option("--threshold <number>", "confidence threshold 0-1", "0.7")
  .option("--format <formats>", "output formats: claude,agents,cursor,copilot,skills,rulesync,ruler (comma-separated)", "claude,agents")
  .action(generateAction);

program
  .command("inspect")
  .description("Display detected conventions")
  .argument("[path]", "project root to analyze", ".")
  .option("--threshold <number>", "confidence threshold 0-1", "0.7")
  .action(inspectAction);

program
  .command("drift")
  .description("Check context files against code for semantic drift")
  .argument("[path]", "project root to analyze", ".")
  .option("--file <contextFile>", "specific context file to check")
  .action(driftAction);

program
  .command("update")
  .description("Update drifted sections in context files, preserving manual edits")
  .argument("[path]", "project root to analyze", ".")
  .option("--file <contextFile>", "specific context file to update")
  .option("--dry-run", "preview changes without writing files")
  .option("-y, --yes", "non-interactive mode")
  .action(updateAction);

await program.parseAsync();
