export interface BaseStep {
  id?: string;
  name?: string;
  env?: Record<string, string>;
  ifExpression?: string;
  workingDirectory?: string;
  continueOnError?: boolean;
  timeout?: number;
}

export type Step = RunStep | UseStep;

export interface RunStep extends BaseStep {
  run: string;
}

export interface UseStep extends BaseStep {
  uses: string;
  with?: Record<string, string | number | boolean>;
}

export const isUseStep = (step: Step): step is UseStep => {
  return (step as UseStep).uses !== undefined;
};
