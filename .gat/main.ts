import { Engine } from "../src/index";

// Templates
import buildWorkflow from "./templates/build";

const engine = new Engine({
  clearExistingWorkflows: true,
});

engine.addWorkflow("build1", buildWorkflow);
engine.addWorkflow("build2", buildWorkflow);

engine.run();
