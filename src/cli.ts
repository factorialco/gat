#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { Command } from "commander";
import { promisify } from "util";

const execPromise = promisify(exec);
const folder = path.join(process.cwd(), ".github", "templates");

const cli = new Command();

cli
  .version("2.0.0")
  .description("Write your GitHub Actions workflows using TypeScript");

cli
  .command("build")
  .description("Transpile all Gat templates into GitHub Actions workflows.")
  .action(async () => {
    if (!fs.existsSync(path.join(folder, "..", "workflows"))) {
      fs.mkdirSync(path.join(folder, "..", "workflows"));
    }

    await execPromise(
      `npx ts-node ${process.env["GAT_BUILD_FLAGS"] ?? "--swc -T"} ${path.join(
        folder,
        "index.ts"
      )}`
    );

    process.exit(0);
  });

cli.parse(process.argv);
