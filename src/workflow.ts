import { dump } from "js-yaml";
import kebabCase from "lodash/kebabCase";
import fs from "fs";
import path from "path";
import { promisify } from "util";

import { ConcurrencyGroup, Job, JobOptions, StringWithNoSpaces } from "./job";
import type { Event, EventName, EventOptions } from "./event";
import { BaseStep, Step } from "./step";

const writeFilePromise = promisify(fs.writeFile);

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
  concurrencyGroup?: ConcurrencyGroup;

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
    options: JobOptions<JobStep, Runner, JobName>
  ): Workflow<JobStep, Runner, JobName | T> {
    this.jobs = [...this.jobs, { name, options }];
    return this;
  }

  setEnv(name: string, value: string) {
    this.env = [...this.env, { name, value }];
    return this;
  }

  setConcurrencyGroup(concurrencyGroup: ConcurrencyGroup) {
    this.concurrencyGroup = concurrencyGroup;
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

  compile(filepath?: string) {
    const result = {
      name: this.name,
      on: Object.fromEntries(
        this.events.map(({ name, options }) => [name, options ? options : null])
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
              workingDirectory,
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
                    matrix:
                      typeof matrix === "string"
                        ? matrix
                        : {
                            ...Object.fromEntries(
                              matrix.elements.map(({ id, options }) => [
                                id,
                                options,
                              ])
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
              steps: steps.map(
                ({
                  id,
                  name,
                  ifExpression,
                  workingDirectory,
                  continueOnError,
                  timeout,
                  ...options
                }) => ({
                  id,
                  name,
                  if: ifExpression,
                  "continue-on-error": continueOnError,
                  "working-directory": workingDirectory,
                  "timeout-minutes": timeout,
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
      }
    )}`;

    if (!filepath) return compiled;

    return writeFilePromise(
      path.join(process.cwd(), ".github", "workflows", filepath),
      compiled
    );
  }
}
