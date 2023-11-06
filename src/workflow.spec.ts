import { describe, it, expect } from "vitest";
import { RunStep, UseStep } from "./step";
import { Workflow } from "./workflow";

describe("Workflow", () => {
  it("generates a simple workflow", async () => {
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

    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows multiple events", async () => {
    const workflow = new Workflow("Multiple events");
    workflow
      .on("push", { branches: ["main"] })
      .on("pull_request", { types: ["opened"] })
      .addJob("job1", {
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows declaring default options", async () => {
    const workflow = new Workflow("Default options");
    workflow
      .on("push", { branches: ["main"] })
      .addDefaults({
        workingDirectory: "frontend",
      })
      .addJob("job1", {
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows declaring environment variables", async () => {
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
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows using a concurrency group", async () => {
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
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows using outputs", async () => {
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
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows conditional jobs", async () => {
    const workflow = new Workflow("Conditional job");
    workflow.on("push").addJob("job1", {
      ifExpression: "${{ github.ref != 'refs/heads/main' }}",
      steps: [
        {
          run: "exit 0",
        },
      ],
    });
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows a job matrix", async () => {
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
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows uses steps", async () => {
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
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows custom types in a workflow", async () => {
    interface MyUseStep extends UseStep {
      uses: "custom-action";
      with: { foo: string };
    }
    type CustomStep = RunStep | MyUseStep;
    type CustomRunner = "standard-runner";

    const workflow = new Workflow<CustomStep, CustomRunner>(
      "With custom types",
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

    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("support workflow dispatch event", async () => {
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
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("supports schedule event", async () => {
    const workflow = new Workflow("Schedule")
      .on("schedule", [{ cron: "0 4 * * 1-5" }])
      .addJob("job1", {
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("supports a pretty name for the job", async () => {
    const workflow = new Workflow("Job with pretty name")
      .on("push")
      .addJob("job1", {
        prettyName: "My pretty name",
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows permissions into jobs", async () => {
    const workflow = new Workflow("Job with permissions")
      .on("push")
      .addJob("job1", {
        permissions: {
          contents: "read",
          "pull-requests": "write",
        },
        steps: [{ name: "Do something", run: "exit 0" }],
      });
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows multiline strings", async () => {
    const workflow = new Workflow("Multiline strings")
      .on("push")
      .addJob("job1", {
        steps: [
          {
            name: "Do something",
            run: `echo foo
exit 0`,
          },
        ],
      });
    expect(await workflow.compile()).toMatchSnapshot();
  });

  it("allows concurrency groups at workflow level", async () => {
    const workflow = new Workflow("Concurrency at workflow level")
      .on("push")
      .setConcurrencyGroup({
        groupSuffix: "${{ github.workflow }}-${{ github.ref }}",
        cancelPrevious: true,
      })
      .addJob("job1", {
        steps: [
          {
            name: "Do something",
            run: "exit 0",
          },
        ],
      });
    expect(await workflow.compile()).toMatchSnapshot();
  });
});
