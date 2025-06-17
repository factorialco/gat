export type ConcurrencyGroup = {
  groupSuffix: string;
  cancelPrevious: boolean;
};

export interface Matrix {
  elements: Array<{ id: string; options: Array<string | number | boolean> }>;
  extra?: Array<Record<string, string | number | boolean>>;
}

export interface Service {
  image: string;
  credentials?: { username: string; password: string };
  env?: Record<string, string>;
  ports: string[];
  options?: string;
  volumes?: string[];
}

export interface StepsJobOptions<Step, RunnerDefinition, Name> {
  prettyName?: string;
  permissions?: object;
  ifExpression?: string;
  runsOn?: RunnerDefinition;
  timeout?: number;
  dependsOn?: Array<Name>;
  services?: Record<string, Service>;
  env?: Record<string, string>;
  concurrency?: ConcurrencyGroup | null;
  matrix?: Matrix | string;
  outputs?: Record<string, string>;
  workingDirectory?: string;
  environment?: string;
  steps: Step[];
}

export interface UsesJobOptions<Name> {
  prettyName?: string;
  dependsOn?: Array<Name>;
  ifExpression?: string;
  uses: string;
  with?: Record<string, string | number | boolean | object>;
  secrets?: Record<string, string | number | boolean | object> | "inherit";
  environment?: string;
}

export type StringWithNoSpaces<T> = T extends `${string} ${string}`
  ? never
  : T extends ` ${string}`
    ? never
    : T extends `${string} `
      ? never
      : T;

export interface Job<Step, RunnerDefinition, Name> {
  name: string;
  options: StepsJobOptions<Step, RunnerDefinition, Name> | UsesJobOptions<Name>;
}
