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
  .command("init")
  .description("Create gat scaffold for this project")
  .action(() => {
    fs.mkdirSync(path.join(process.cwd(), ".gat"));
  });

cli
  .command("build")
  .description("Transpile all Gat templates into GitHub Actions workflows.")
  .action(() => {
    const childProcess = exec("npx ts-node .gat/main.ts");
    childProcess.stdout?.pipe(process.stdout);
    childProcess.stderr?.pipe(process.stderr);
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
