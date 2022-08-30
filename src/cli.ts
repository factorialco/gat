#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { Command } from "commander";
import { promisify } from "util";

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);

const parseFile = async (templateFile: string) => {
  const { stdout } = await execPromise(`npx ts-node ${templateFile}`);

  await writeFilePromise(
    path.join(
      process.cwd(),
      ".github",
      "workflows",
      templateFile.split("/").at(-1)!.replace(".ts", ".yml")
    ),
    stdout
  );
};

const cli = new Command();

cli.version("0.0.1").description("TODO");

cli
  .command("build")
  .description("TODO")
  .argument("[file]", "TODO")
  .action(async (file) => {
    const folder = path.join(process.cwd(), ".github", "templates");

    if (!fs.existsSync(path.join(folder, "..", "workflows"))) {
      fs.mkdirSync(path.join(folder, "..", "workflows"));
    }

    if (file !== undefined) {
      await parseFile(file);
    } else {
      await Promise.all(
        fs.readdirSync(folder).map(async (templateFile) => {
          if (!templateFile.match(/^shared$/)) {
            await parseFile(`${path.join(folder, templateFile)}`);
          }
        })
      );
    }

    process.exit(0);
  });

cli.parse(process.argv);
