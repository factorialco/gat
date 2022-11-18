export interface ConcurrencyGroup {
  groupSuffix: string;
  cancelPrevious: boolean;
}

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
}
export interface JobOptions<Step, Runner, Name> {
  prettyName?: string;
  permissions?: object;
  ifExpression?: string;
  runsOn?: Runner;
  timeout?: number;
  dependsOn?: Array<Name>;
  services?: Record<string, Service>;
  env?: Record<string, string>;
  concurrency?: ConcurrencyGroup;
  matrix?: Matrix;
  steps: Step[];
  outputs?: Record<string, string>;
  workingDirectory?: string;
}

export type StringWithNoSpaces<T> = T extends `${string} ${string}`
  ? never
  : T extends ` ${string}`
  ? never
  : T extends `${string} `
  ? never
  : T;

export interface Job<Step, Runner, Name> {
  name: string;
  options: JobOptions<Step, Runner, Name>;
}
