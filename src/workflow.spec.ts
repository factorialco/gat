import { describe, it, expect } from "vitest";
import { RunStep, UseStep } from "./step";
import { Workflow } from "./workflow";

describe("Workflow", () => {
  it("generates a simple workflow", () => {
    const workflow = new Workflow("Simple");
    workflow
      .on("pull_request", { types: ["opened"] })
      .addJob("job1", {
        steps: [{ name: "Do something", run: "exit 0" }],
      })
      .addJob("job2", {
        steps: [{ name: "Do something else", run: "exit 0" }],
        dependsOn: ["job1"],
      });

    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows multiple events", () => {
    const workflow = new Workflow("Multiple events");
    workflow
      .on("push", { branches: ["main"] })
      .on("pull_request", { types: ["opened"] })
      .addJob("job1", {
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows declaring default options", () => {
    const workflow = new Workflow("Default options");
    workflow
      .on("push", { branches: ["main"] })
      .addDefaults({
        workingDirectory: "frontend",
      })
      .addJob("job1", {
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows declaring environment variables", () => {
    const workflow = new Workflow("With Environment variables");
    workflow
      .on("push")
      .setEnv("NODE_VERSION", "16")
      .setEnv("ENABLED", "true")
      .addJob("job1", {
        steps: [
          {
            name: "Do something",
            run: "echo ${{ env.NODE_VERSION }} && echo ${{ env.ENABLED }}",
          },
        ],
      });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows using a concurrency group", () => {
    const workflow = new Workflow("Concurrency group");
    workflow.on("push").addJob("job1", {
      concurrency: {
        groupSuffix: "foo",
        cancelPrevious: true,
      },
      steps: [
        {
          run: "echo 0",
        },
      ],
    });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows using outputs", () => {
    const workflow = new Workflow("Using outputs");
    workflow.on("push").addJob("job1", {
      steps: [
        {
          id: "random-number",
          run: 'echo "::set-output name=random-number::$RANDOM"',
        },
      ],
      outputs: {
        "random-number": "${{ steps.random-number.outputs.random-number }}",
      },
    });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows conditional jobs", () => {
    const workflow = new Workflow("Conditional job");
    workflow.on("push").addJob("job1", {
      ifExpression: "${{ github.ref != 'refs/heads/main' }}",
      steps: [
        {
          run: "exit 0",
        },
      ],
    });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows a job matrix", () => {
    const workflow = new Workflow("Conditional job");
    workflow.on("push").addJob("job1", {
      matrix: {
        elements: [
          {
            id: "food",
            options: ["🍕", "🍔"],
          },
          {
            id: "topping",
            options: ["🍍"],
          },
        ],
        extra: [
          {
            food: "🍕",
            topping: "🍍",
            tasty: true,
          },
        ],
      },
      steps: [
        {
          run: "echo ${{ matrix.food }} with ${{ matrix.topping }}",
        },
      ],
    });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows uses steps", () => {
    const workflow = new Workflow("Uses steps");
    workflow
      .on("push")
      .setEnv("NODE_VERSION", "16")
      .setEnv("ENABLED", "true")
      .addJob("job1", {
        steps: [
          {
            uses: "actions/checkout@v3",
            with: {
              ref: "main",
            },
          },
        ],
      });
    expect(workflow.compile()).toMatchSnapshot();
  });

  it("allows custom types in a workflow", () => {
    interface MyUseStep extends UseStep {
      uses: "custom-action";
      with: { foo: string };
    }
    type CustomStep = RunStep | MyUseStep;
    type CustomRunner = "standard-runner";

    const workflow = new Workflow<CustomStep, CustomRunner>(
      "With custom types"
    );

    workflow.on("push").addJob("job1", {
      runsOn: "standard-runner",
      steps: [
        {
          run: "echo 'Do something'",
        },
        {
          uses: "custom-action",
          with: {
            foo: "bar",
          },
        },
      ],
    });

    expect(workflow.compile()).toMatchSnapshot();
  });

  it("support workflow dispatch event", () => {
    const workflow = new Workflow("Workflow dispatch");
    workflow
      .on("workflow_dispatch", {
        inputs: {
          foo: {
            description: "A foo input",
            required: true,
          },
          bar: {
            description: "A bar input",
            type: "choice",
            options: ["bar", "baz"],
          },
        },
      })
      .addJob("job1", {
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(workflow.compile()).toMatchSnapshot();
  });
});
