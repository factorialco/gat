import { Engine } from "../src/index";
import workflow2 from "./templates/build";

// Templates
import buildWorkflow from "./templates/build";

const engine = new Engine({
  clearExistingWorkflows: true,
});

engine.addWorkflow("build1", buildWorkflow);

engine.run();

// interface Dog<T = never> {
//   name: string;
//   skills: T;
// }

workflow2
  .addJob("a", { steps: [] })
  .addJob("b", { dependsOn: ["a"], steps: [] });

const foo = <T = never>(something: T) => {
  return something;
};

foo("a");
foo(3);
foo({});

class Dog<JobName = never> {
  jobNames: Array<JobName>;

  addJob<T extends string>(name: T) {
    this.jobNames = [...this.jobNames, name];
    return this;
  }
}
