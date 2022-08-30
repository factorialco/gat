export type EventName =
  | "push"
  | "pull_request"
  | "pull_request_review"
  | "workflow_run"
  | "workflow_dispatch"
  | "schedule";

export type EventOptions<T extends EventName> = T extends "push"
  ? PushEventOptions
  : T extends "pull_request"
  ? PullRequestEventOptions
  : T extends "pull_request_review"
  ? PullRequestReviewEventOptions
  : T extends "workflow_run"
  ? WorkflowRunEventOptions
  : T extends "workflow_dispatch"
  ? WorkflowDispatchEventOptions
  : T extends "schedule"
  ? ScheduleEventOptions
  : never;

interface PushEventOptions {
  branches?: string[];
  paths?: string[];
}

interface PullRequestEventOptions {
  branches?: string[];
  paths?: string[];
  types?: Array<
    "opened" | "reopened" | "synchronize" | "labeled" | "unlabeled"
  >;
}

interface PullRequestReviewEventOptions {
  types?: Array<"submitted">;
}
interface WorkflowRunEventOptions {
  workflows?: string[];
  types?: Array<"completed">;
}

interface WorkflowDispatchInput {
  description: string;
  required?: boolean;
  type?: "choice" | "boolean";
  options?: string[];
}
interface WorkflowDispatchEventOptions {
  inputs?: Record<string, WorkflowDispatchInput>;
}

type ScheduleEventOptions = Array<{ cron: string }>;

export interface Event {
  name: EventName;
  options?: EventOptions<EventName>;
}
