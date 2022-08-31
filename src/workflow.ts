import { dump } from "js-yaml";
import kebabCase from "lodash/kebabCase";

import { Job, JobOptions } from "./job";
import type { Event, EventName, EventOptions } from "./event";
import { BaseStep, Step } from "./step";
import { compact, trim } from "lodash";

const DEFAULT_RUNNERS = ["ubuntu-22.04"];

interface DefaultOptions {
  workingDirectory: string;
}

interface EnvVar {
  name: string;
  value: string;
}

export class Workflow<
  JobStep extends BaseStep = Step,
  Runner = typeof DEFAULT_RUNNERS,
  JobName = never
> {
  events: Event[];
  jobs: Array<Job<JobStep, Runner, JobName>>;
  defaultOptions: DefaultOptions | null;
  env: EnvVar[];

  constructor(public name: string) {
    this.events = [];
    this.jobs = [];
    this.defaultOptions = null;
    this.env = [];
  }

  on<T extends EventName>(name: T, options?: EventOptions<T>) {
    this.events = [...this.events, { name, options }];
    return this;
  }

  addDefaults(options: DefaultOptions) {
    this.defaultOptions = options;
    return this;
  }

  addJob<T extends string>(
    name: T,
    options: JobOptions<JobStep, Runner, JobName>
  ): Workflow<JobStep, Runner, JobName | T> {
    this.jobs = [...this.jobs, { name, options }];
    return this;
  }

  setEnv(name: string, value: string) {
    this.env = [...this.env, { name, value }];
    return this;
  }

  defaultRunner() {
    return "ubuntu-22.04";
  }

  private assignRunner(runsOn?: Runner) {
    const runnerName = runsOn ?? this.defaultRunner();
    const isSelfHosted = !DEFAULT_RUNNERS.includes(runnerName as string);

    return isSelfHosted ? ["self-hosted", runnerName] : runnerName;
  }

  compile() {
    const result = {
      name: this.name,
      on: Object.fromEntries(
        this.events.map(({ name, options }) => [name, options ? options : null])
      ),
      defaults: this.defaultOptions
        ? {
            run: {
              "working-directory": this.defaultOptions.workingDirectory,
            },
          }
        : undefined,
      env:
        this.env.length > 0
          ? Object.fromEntries(this.env.map(({ name, value }) => [name, value]))
          : undefined,
      jobs: Object.fromEntries(
        this.jobs.map(
          ({
            name,
            options: {
              prettyName,
              permissions,
              ifExpression,
              runsOn,
              matrix,
              env,
              steps,
              dependsOn,
              services,
              timeout,
              concurrency,
              outputs,
            },
          }) => [
            name,
            {
              name: prettyName,
              permissions,
              if: ifExpression,
              "runs-on": this.assignRunner(runsOn),
              "timeout-minutes": timeout ?? 15,
              needs: dependsOn,
              services,
              concurrency: concurrency
                ? {
                    group: `${kebabCase(this.name)}-${name}-${
                      concurrency.groupSuffix
                    }`,
                    "cancel-in-progress": concurrency.cancelPrevious,
                  }
                : undefined,
              strategy: matrix
                ? {
                    "fail-fast": false,
                    matrix: {
                      ...Object.fromEntries(
                        matrix.elements.map(({ id, options }) => [id, options])
                      ),
                      include: matrix.extra,
                    },
                  }
                : undefined,
              env,
              steps: steps.map(
                ({
                  id,
                  name,
                  ifExpression,
                  workingDirectory,
                  continueOnError,
                  ...options
                }) => ({
                  id,
                  name,
                  if: ifExpression,
                  "continue-on-error": continueOnError,
                  "working-directory": workingDirectory,
                  ...options,
                })
              ),
              outputs,
            },
          ]
        )
      ),
    };

    const compiled = `# Workflow automatically generated by gat\n# DO NOT CHANGE THIS FILE MANUALLY\n\n${dump(
      result,
      {
        noRefs: true,
        lineWidth: 200,
        noCompatMode: true,
        replacer: (_, value) => {
          if (typeof value === "string") {
            if (value.startsWith("\n")) {
              return compact(value.split("\n").map((str) => trim(str))).join(
                "\n"
              );
            }
            return value;
          }
          return value;
        },
      }
    )}`;

    console.log(compiled);

    return compiled;
  }
}
