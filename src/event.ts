export type EventName = "push" | "pull_request";

export type EventOptions<T extends EventName> = T extends "push"
  ? PushEventOptions
  : T extends "pull_request"
  ? PullRequestEventOptions
  : never;

interface PushEventOptions {
  branches?: string[];
  paths?: string[];
}

interface PullRequestEventOptions {
  types?: Array<"opened" | "reopened" | "synchronize">;
  paths?: string[];
}

export interface Event {
  name: EventName;
  options?: EventOptions<EventName>;
}
