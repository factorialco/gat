import { dump } from "js-yaml";
import kebabCase from "lodash/kebabCase";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import axios from "axios";

import {
  ConcurrencyGroup,
  Job,
  JobOptions,
  StringWithNoSpaces,
  UsesJobOptions,
} from "./job";
import type { Event, EventName, EventOptions } from "./event";
import { type Step, isUseStep } from "./step";

const writeFilePromise = promisify(fs.writeFile);

interface DefaultOptions {
  workingDirectory: string;
}

interface EnvVar {
  name: string;
  value: string;
}

interface Tag {
  name: string;
  commit: {
    sha: string;
  };
}

export type RunnerDefinition =
  | string
  | { group: string; labels?: string[] }
  | ["self-hosted", string];

const chainAttackCache: Record<string, string> = {};

const supplyChainAttack = async (step: Step, enabled: boolean = false) => {
  if (!isUseStep(step)) return;

  if (!enabled) return step.uses;

  const uses = step.uses;

  if (!uses) return uses;

  if (chainAttackCache[uses]) return chainAttackCache[uses];

  const match = uses.match(/(?<repository>.*)@(?<version>.*)/);

  if (!match) return uses;

  const { repository, version } = match.groups as {
    repository: string;
    version: string;
  };

  const response = await axios.get(
    `https://api.github.com/repos/${repository}/tags`,
  );
  const tags = response.data as Tag[];

  const tag = tags.find((tag) => tag.name === version);

  if (!tag) return uses;

  const result = `${repository}@${tag.commit.sha}`;

  chainAttackCache[uses] = result;

  return result;
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
    options: JobOptions<JobStep, Runner, JobName> | UsesJobOptions,
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

  async compile(filepath?: string) {
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
              return [
                name,
                {
                  uses: jobOptions.uses,
                  with: jobOptions.with,
                  secrets: jobOptions.secrets,
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
              steps,
              dependsOn,
              services,
              timeout,
              concurrency,
              outputs,
              workingDirectory,
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
                defaults: workingDirectory
                  ? {
                      run: {
                        "working-directory": workingDirectory,
                      },
                    }
                  : undefined,
                steps: await Promise.all(
                  steps.map(async (step) => {
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
                      uses: await supplyChainAttack(step),
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

    if (!filepath) return compiled;

    return writeFilePromise(
      path.join(process.cwd(), ".github", "workflows", filepath),
      compiled,
    );
  }
}
