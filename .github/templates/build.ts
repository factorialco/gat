import { UseStep, Workflow } from "../../src";

const checkoutStep: UseStep = {
  uses: "actions/checkout@v3",
};

const setupNodeStep: UseStep = {
  uses: "actions/setup-node@v3",
};

new Workflow("Build")
  .on("push", { branches: ["main"] })
  .on("pull_request")
  .addJob("build", {
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
  })
  .compile();
