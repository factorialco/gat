import fs from "fs";
import { Octokit } from "@octokit/rest";

import { Workflow } from "./workflow";

interface CompileOptions<T extends Workflow> {
  templates: Record<string, T>;
  lockFilePath: string;
  writeLockFile: boolean;
}

const createLockFile = async (
  templates: Record<string, Workflow>,
  lockFilePath: string,
) => {
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

  const uniqueActions = [...new Set(actions)];

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
      if (/^[a-f0-9]{40}$/.test(version)) {
        // Assume version is a SHA
        resolvedActions[action] = `${repository}@${version}`;
      } else {
        const response = await octokit.rest.repos.listTags({
          owner,
          repo,
        });

        const tag = response.data.find((tag) => tag.name === version);

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
  const { templates, lockFilePath, writeLockFile } = options;

  if (writeLockFile) {
    await createLockFile(templates, lockFilePath);
  }

  const resolvedActions = fs.existsSync(lockFilePath)
    ? JSON.parse(fs.readFileSync(lockFilePath, "utf8"))
    : {};

  return Promise.all(
    Object.entries(templates).map(([filePath, template]) =>
      template.compile({ filePath, resolvedActions }),
    ),
  );
};
