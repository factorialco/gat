import fs from "fs";
import { Octokit } from "@octokit/rest";

import { Workflow } from "./workflow";

interface CompileOptions<T extends Workflow> {
  templates: Record<string, T>;
  lockFilePath?: string;
  writeLockFile?: boolean;
  failOnUnlockedActions?: boolean;
}

const SHA_PATTERN = /^[a-f0-9]{40}$/;

const collectActions = (templates: Record<string, Workflow>) => {
  const actions = Object.values(templates).reduce<string[]>((acc, template) => {
    template.jobs.forEach((job) => {
      if ("steps" in job.options) {
        job.options.steps.forEach((step) => {
          if ("uses" in step) {
            acc.push(step.uses);
          }
        });
      }
    });

    return acc;
  }, []);

  return [...new Set(actions)];
};

// Local and docker actions are not tag references, so the lock file never
// holds an entry for them.
const isLockable = (action: string) =>
  !action.startsWith("./") && !action.startsWith("docker://");

const findUnlockedActions = (
  templates: Record<string, Workflow>,
  resolvedActions: Record<string, string>,
) =>
  collectActions(templates).filter((action) => {
    if (!isLockable(action) || action in resolvedActions) return false;

    const version = action.split("@").pop() ?? "";
    return !SHA_PATTERN.test(version);
  });

const createLockFile = async (
  templates: Record<string, Workflow>,
  lockFilePath: string,
) => {
  const uniqueActions = collectActions(templates);

  const octokit = process.env.GITHUB_TOKEN
    ? new Octokit({
        auth: process.env.GITHUB_TOKEN,
      })
    : new Octokit();

  const resolvedActions: Record<string, string> = {};

  await Promise.all(
    uniqueActions.map(async (action) => {
      const match = action.match(/(?<repository>.*)@(?<version>.*)/);

      if (!match) return;

      const { repository, version } = match.groups as {
        repository: string;
        version: string;
      };

      const [owner, repo] = repository.split("/");
      if (SHA_PATTERN.test(version)) {
        // Assume version is a SHA
        resolvedActions[action] = `${repository}@${version}`;
      } else {
        let tag = null;
        let page = 1;
        const perPage = 100;

        while (!tag) {
          const response = await octokit.rest.repos.listTags({
            owner,
            repo,
            per_page: perPage,
            page,
          });

          tag = response.data.find((tag) => tag.name === version);

          if (response.data.length < perPage) {
            break; // No more pages to check
          }

          page++;
        }

        if (!tag) {
          throw new Error(`Unable to retrieve ${action} from Github tags`);
        }

        resolvedActions[action] = `${repository}@${tag.commit.sha}`;
      }
    }),
  );

  fs.writeFileSync(lockFilePath, JSON.stringify(resolvedActions, null, 2));
};

export const compileTemplates = async <T extends Workflow>(
  options: CompileOptions<T>,
) => {
  const { templates, lockFilePath, writeLockFile, failOnUnlockedActions } =
    options;

  // Without a lock file the workflows keep the refs the templates use, which
  // is what an external lock such as GitHub's actions.lock expects.
  if (!lockFilePath) {
    if (writeLockFile || failOnUnlockedActions) {
      throw new Error(
        "writeLockFile and failOnUnlockedActions need a lockFilePath",
      );
    }

    return Promise.all(
      Object.entries(templates).map(([filePath, template]) =>
        template.compile({ filePath }),
      ),
    );
  }

  if (writeLockFile) {
    await createLockFile(templates, lockFilePath);
  }

  const resolvedActions = fs.existsSync(lockFilePath)
    ? JSON.parse(fs.readFileSync(lockFilePath, "utf8"))
    : {};

  // A step whose action is missing from the lock file compiles with its
  // mutable tag, which silently undoes the pinning the lock file exists for.
  if (failOnUnlockedActions) {
    const unlocked = findUnlockedActions(templates, resolvedActions);

    if (unlocked.length > 0) {
      throw new Error(
        `Actions missing from ${lockFilePath}, regenerate it with writeLockFile enabled:\n` +
          unlocked.map((action) => `  - ${action}`).join("\n"),
      );
    }
  }

  return Promise.all(
    Object.entries(templates).map(([filePath, template]) =>
      template.compile({ filePath, resolvedActions }),
    ),
  );
};
