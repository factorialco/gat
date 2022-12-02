import { UseStep, Workflow } from "../../src";
import { IWorkflow } from "../../src/workflow";

const checkoutStep: UseStep = {
  uses: "actions/checkout@v3",
};

const setupNodeStep: UseStep = {
  uses: "actions/setup-node@v3",
};

const workflow = new Workflow("Build")
  .on("push", { branches: ["main"] })
  .on("pull_request");

const workflow2 = workflow.addJob("build", {
  steps: [
    checkoutStep,
    setupNodeStep,
    {
      name: "Install dependencies",
      run: "npm ci",
    },
    {
      name: "Ensure workflows are up to date",
      run: `
          npx ts-node src/cli.ts build
          git diff --exit-code .github/workflows/build.yml
        `,
    },
    { name: "Run tests", run: "npm test" },
    { name: "Check lint problems", run: "npm run lint" },
    { name: "Check format problems", run: "npm run format:check" },
  ],
});

const workflow3 = workflow2.addJob("mufasa", {
  dependsOn: ["build"],
  steps: [],
});

const foo = (workflow: IWorkflow) => {
  console.log(workflow);
};

foo(workflow3);

export default workflow3.addDefaults({ workingDirectory: "foo" });
