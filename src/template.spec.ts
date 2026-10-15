import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { compileTemplates } from "./template";
import { Workflow } from "./workflow";

const LOCKED_SHA = "a".repeat(40);

const buildTemplates = (...uses: string[]) => {
  const workflow = new Workflow("Workflow");
  workflow.on("push").addJob("job1", {
    steps: uses.map((action) => ({ name: action, uses: action })),
  });

  return { "workflow.yml": workflow };
};

describe("compileTemplates", () => {
  let dir: string;
  let lockFilePath: string;

  const readCompiled = () =>
    fs.readFileSync(
      path.join(dir, ".github", "workflows", "workflow.yml"),
      "utf8",
    );

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gat-"));
    fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(dir);

    lockFilePath = path.join(dir, "gat-lock.json");
    fs.writeFileSync(
      lockFilePath,
      JSON.stringify({
        "actions/checkout@v4": `actions/checkout@${LOCKED_SHA}`,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("compiles unlocked actions with their tag by default", async () => {
    await compileTemplates({
      templates: buildTemplates("actions/setup-node@v4"),
      lockFilePath,
      writeLockFile: false,
    });

    expect(readCompiled()).toContain("uses: actions/setup-node@v4");
  });

  it("fails on actions missing from the lock file", async () => {
    await expect(
      compileTemplates({
        templates: buildTemplates(
          "actions/checkout@v4",
          "actions/setup-node@v4",
          "pnpm/action-setup@v4",
        ),
        lockFilePath,
        writeLockFile: false,
        failOnUnlockedActions: true,
      }),
    ).rejects.toThrow(/actions\/setup-node@v4\n {2}- pnpm\/action-setup@v4$/);
    expect(fs.readdirSync(path.join(dir, ".github", "workflows"))).toEqual([]);
  });

  it("accepts locked, SHA, local and docker actions", async () => {
    await compileTemplates({
      templates: buildTemplates(
        "actions/checkout@v4",
        `actions/cache@${"b".repeat(40)}`,
        "./.github/actions/local",
        "docker://alpine:3.20",
      ),
      lockFilePath,
      writeLockFile: false,
      failOnUnlockedActions: true,
    });

    expect(readCompiled()).toContain(`uses: actions/checkout@${LOCKED_SHA}`);
  });
});
