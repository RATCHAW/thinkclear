import { afterEach } from "vitest";
import { cleanup } from "vitest-browser-react/pure";
import "@fontsource-variable/manrope";
import "../src/index.css";

afterEach(async () => {
  await cleanup();
});
