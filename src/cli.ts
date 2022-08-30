#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { Command } from "commander";
import { promisify } from "util";

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);

const cli = new Command();

cli.version("0.0.1").description("TODO");

cli
  .command("build")
  .description("TODO")
  .action(async () => {
    const folder = path.join(process.cwd(), ".github", "templates");

    if (!fs.existsSync(path.join(folder, "..", "workflows"))) {
      fs.mkdirSync(path.join(folder, "..", "workflows"));
    }

    await Promise.all(
      fs.readdirSync(folder).map(async (templateFile) => {
        if (!templateFile.match(/^shared$/)) {
          const { stdout } = await execPromise(
            `npx ts-node ${path.join(folder, templateFile)}`
          );
          await writeFilePromise(
            path.join(
              folder,
              "..",
              "workflows",
              templateFile.replace(".ts", ".yml")
            ),
            stdout
          );
        }
      })
    );

    process.exit(0);
  });

cli.parse(process.argv);
