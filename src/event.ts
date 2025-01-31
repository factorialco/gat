export type EventName =
  | "push"
  | "pull_request"
  | "pull_request_review"
  | "workflow_run"
  | "workflow_dispatch"
  | "workflow_call"
  | "schedule"
  | "pull_request_target"
  | "repository_dispatch";

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
  : T extends "workflow_call"
  ? WorkflowCallEventOptions
  : T extends "schedule"
  ? ScheduleEventOptions
  : T extends "repository_dispatch"
  ? RepositoryDispatchEventOptions
  : never;

interface PushEventOptions {
  branches?: string[];
  paths?: string[];
}

interface PullRequestEventOptions {
  branches?: string[];
  paths?: string[];
  types?: Array<
    | "assigned"
    | "unassigned"
    | "labeled"
    | "unlabeled"
    | "opened"
    | "edited"
    | "closed"
    | "reopened"
    | "synchronize"
    | "converted_to_draft"
    | "locked"
    | "unlocked"
    | "enqueued"
    | "dequeued"
    | "milestoned"
    | "demilestoned"
    | "ready_for_review"
    | "review_requested"
    | "review_request_removed"
    | "auto_merge_enabled"
    | "auto_merge_disabled"
  >;
}

interface PullRequestReviewEventOptions {
  types?: Array<"submitted">;
}
interface WorkflowRunEventOptions {
  workflows?: string[];
  types?: Array<"completed">;
  branches?: string[];
}

interface WorkflowDispatchInput {
  description: string;
  required?: boolean;
  type?: "choice" | "boolean" | "string";
  options?: string[];
  default?: string | boolean;
}
interface WorkflowDispatchEventOptions {
  inputs?: Record<string, WorkflowDispatchInput>;
}

interface WorkflowCallSecret {
  description?: string;
  required?: boolean;
}

interface WorkflowCallEventOptions {
  inputs?: Record<string, WorkflowDispatchInput>;
  secrets?: Record<string, WorkflowCallSecret>;
}

type ScheduleEventOptions = Array<{ cron: string }>;

interface RepositoryDispatchEventOptions {
  types: string[];
}

export interface Event {
  name: EventName;
  options?: EventOptions<EventName>;
}
