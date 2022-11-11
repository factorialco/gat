#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { Command } from "commander";
import { promisify } from "util";
import debounce from "lodash/debounce";

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const folder = path.join(process.cwd(), ".github", "templates");

const parseFile = async (templateFile: string) => {
  // NOTE: can we improve this using ts-node or typescript programatically?
  const { stdout } = await execPromise(`npx ts-node --swc -T ${templateFile}`);

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

cli
  .version("1.0.0")
  .description("Write your GitHub Actions workflows using TypeScript");

cli
  .command("build")
  .description("Transpile all Gat templates into GitHub Actions workflows.")
  .argument("[file]", "(Optional) A Gat template file")
  .action(async (file) => {
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

cli
  .command("watch")
  .description(
    "Watch file changes in your Gat templates folder and transpile them automatically."
  )
  .action(async () => {
    const parseWatchedFile = debounce(async (fileName) => {
      const start = process.hrtime.bigint();
      process.stdout.write(
        `😸 Detected change on file ${fileName}. Transpiling... `
      );
      await parseFile(path.join(folder, fileName.toString()));
      console.log(
        `Done in ${(
          Number(process.hrtime.bigint() - start) / 1_000_000
        ).toFixed(2)}ms`
      );
    }, 1000);
    console.log(`😼 Watching file changes on ${folder}...`);
    fs.watch(folder).on("change", (_eventName, fileName) => {
      parseWatchedFile(fileName);
    });
  });

cli.parse(process.argv);
