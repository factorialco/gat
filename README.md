# gat ![Build](https://github.com/factorialco/gat/actions/workflows/build.yml/badge.svg?branch=main) [![npm version](https://badge.fury.io/js/@factorialco%2Fgat.svg)](https://badge.fury.io/js/@factorialco%2Fgat)

The `gat` project is a tool to **write your GitHub Actions workflows using TypeScript**.

Maintaining YAML files is hard and if your project is big enough you will find yourself duplicating a lot of code between your workflows. With `gat` you can create reusable jobs and steps just using TypeScript objects and importing them in your workflow templates.

_Why `gat`?_ The name is an acronym of "GitHub Actions Template Generator" without the last part because `gat` means "cat" in Catalan.

## Installation

Install the main package and its dependencies using the following command:

```bash
npm i -D @factorialco/gat typescript tsx commander @swc/core
```

## Usage

### Writing a template

The `gat` CLI assumes that you have a `index.ts` file inside `.github/templates`. Let's create our first template:

```ts
// .github/templates/index.ts
import { Workflow } from "@factorialco/gat";

new Workflow("My first workflow")
  .on("push")
  .addJob("test", {
    steps: [
      {
        uses: "actions/checkout@v3",
      },
      {
        uses: "actions/setup-node@v3",
      },
      {
        run: "npm test",
      },
    ],
  })
  .compile("my-first-workflow.yml");
```

Notice that you need to call the `compile()` method at the end, passing the file name of the generated Github Actions workflow.

### Compiling your templates

You can build your templates running this command in your root folder:

```bash
npx gat build
```

Following the previous example, you should see now a file `.github/workflows/my-first-workflow.yml` like this:

```yaml
# Workflow automatically generated by gat
# DO NOT CHANGE THIS FILE MANUALLY

name: My first workflow
on:
  push: null
jobs:
  test:
    runs-on: ubuntu-22.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm test
```

Notice that the job includes a few assumptions like the `runs-on` and `timeout-minutes` fields. You can change those when adding a new job.

### Create your own workflow class

TODO

## Contributing

TODO

## License

MIT
