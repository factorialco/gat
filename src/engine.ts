import { IWorkflow } from "./workflow";
import fs from "fs";
import path from "path";
import { Step } from "./step";

const GITHUB_FOLDER = path.join(process.cwd(), ".github");
const GITHUB_WORKFLOWS_FOLDER = path.join(GITHUB_FOLDER, "workflows");

interface Options {
  clearExistingWorkflows: boolean;
}
export class Engine<T extends IWorkflow<Step, string[], never>> {
  workflows: Record<string, T>;
  options: Options;

  constructor(options: Options) {
    this.workflows = {};
    this.options = options;
  }

  addWorkflow(filename: string, workflow: T) {
    this.workflows[filename] = workflow;
  }

  run() {
    const { clearExistingWorkflows } = this.options;

    if (!fs.existsSync(path.join(GITHUB_FOLDER))) {
      fs.mkdirSync(GITHUB_FOLDER);
    }

    if (!fs.existsSync(GITHUB_WORKFLOWS_FOLDER)) {
      fs.mkdirSync(GITHUB_WORKFLOWS_FOLDER);
    }

    if (clearExistingWorkflows) {
      for (const file of fs.readdirSync(GITHUB_WORKFLOWS_FOLDER)) {
        fs.unlinkSync(path.join(GITHUB_WORKFLOWS_FOLDER, file));
      }
    }

    for (const [filename, workflow] of Object.entries(this.workflows)) {
      fs.writeFileSync(
        path.join(GITHUB_WORKFLOWS_FOLDER, `${filename}.yml`),
        workflow.compile()
      );
    }
  }
}
