import fs from "fs";
import { dump } from "js-yaml";
import kebabCase from "lodash/kebabCase";
import path from "path";
import { promisify } from "util";

import type { Event, EventName, EventOptions } from "./event";
import {
  ConcurrencyGroup,
  Job,
  StepsJobOptions,
  StringWithNoSpaces,
  UsesJobOptions,
} from "./job";
import { type Step, isUseStep } from "./step";

const writeFilePromise = promisify(fs.writeFile);

interface DefaultOptions {
  workingDirectory: string;
}

interface EnvVar {
  name: string;
  value: string;
}

interface WorkflowCompileOptions {
  filePath?: string;
  resolvedActions?: Record<string, string>;
}

export type RunnerDefinition =
  | string
  | { group: string; labels?: string[] }
  | ["self-hosted", string];

const supplyChainAttack = async (
  step: Step,
  resolvedActions: Record<string, string>,
) => {
  if (!isUseStep(step)) return;

  const uses = step.uses;

  return resolvedActions[uses] ?? uses;
};

export class Workflow<
  JobStep extends Step = Step,
  Runner extends RunnerDefinition = RunnerDefinition,
  JobName = never,
> {
  events: Event[];
  jobs: Array<Job<JobStep, Runner, JobName>>;
  defaultOptions: DefaultOptions | null;
  env: EnvVar[];
  concurrencyGroup?: ConcurrencyGroup | null;

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
    name: StringWithNoSpaces<T>,
    options:
      | StepsJobOptions<JobStep, Runner, JobName>
      | UsesJobOptions<JobName>,
  ): Workflow<JobStep, Runner, JobName | T> {
    this.jobs = [...this.jobs, { name, options }];
    return this;
  }

  setEnv(name: string, value: string) {
    this.env = [...this.env, { name, value }];
    return this;
  }

  setConcurrencyGroup(concurrencyGroup: ConcurrencyGroup | null) {
    this.concurrencyGroup = concurrencyGroup;
    return this;
  }

  defaultRunner() {
    return "ubuntu-22.04";
  }

  async compile(compileOptions: WorkflowCompileOptions = {}) {
    const result = {
      name: this.name,
      on: Object.fromEntries(
        this.events.map(({ name, options }) => [
          name,
          options ? options : null,
        ]),
      ),
      concurrency: this.concurrencyGroup
        ? {
            group: this.concurrencyGroup.groupSuffix,
            "cancel-in-progress": this.concurrencyGroup.cancelPrevious,
          }
        : undefined,
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
        await Promise.all(
          this.jobs.map(async ({ name, options: jobOptions }) => {
            if ("uses" in jobOptions) {
              const { prettyName, ifExpression, dependsOn, environment } =
                jobOptions;

              return [
                name,
                {
                  name: prettyName,
                  if: ifExpression,
                  needs: dependsOn,
                  uses: jobOptions.uses,
                  with: jobOptions.with,
                  secrets: jobOptions.secrets,
                  environment,
                },
              ];
            }

            const {
              prettyName,
              permissions,
              ifExpression,
              runsOn,
              matrix,
              env,
              dependsOn,
              services,
              timeout,
              concurrency,
              outputs,
              workingDirectory,
              environment,
            } = jobOptions;

            return [
              name,
              {
                name: prettyName,
                permissions,
                if: ifExpression,
                "runs-on": runsOn ?? this.defaultRunner(),
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
                      matrix:
                        typeof matrix === "string"
                          ? matrix
                          : {
                              ...Object.fromEntries(
                                matrix.elements.map(({ id, options }) => [
                                  id,
                                  options,
                                ]),
                              ),
                              include: matrix.extra,
                            },
                    }
                  : undefined,
                env,
                environment,
                defaults: workingDirectory
                  ? {
                      run: {
                        "working-directory": workingDirectory,
                      },
                    }
                  : undefined,
                steps: await Promise.all(
                  jobOptions.steps.map(async (step) => {
                    const {
                      id,
                      name,
                      ifExpression,
                      workingDirectory,
                      continueOnError,
                      timeout,
                      ...options
                    } = step;
                    return {
                      id,
                      name,
                      if: ifExpression,
                      "continue-on-error": continueOnError,
                      "working-directory": workingDirectory,
                      "timeout-minutes": timeout,
                      ...options,
                      uses: await supplyChainAttack(
                        step,
                        compileOptions.resolvedActions ?? {},
                      ),
                    };
                  }),
                ),
                outputs,
              },
            ];
          }),
        ),
      ),
    };

    const compiled = `# Workflow automatically generated by gat\n# DO NOT CHANGE THIS FILE MANUALLY\n\n${dump(
      result,
      {
        noRefs: true,
        lineWidth: 200,
        noCompatMode: true,
      },
    )}`;

    if (!compileOptions.filePath) return compiled;

    return writeFilePromise(
      path.join(process.cwd(), ".github", "workflows", compileOptions.filePath),
      compiled,
    );
  }
}
