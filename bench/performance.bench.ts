import { bench, describe } from "vitest";
import { resolve } from "node:path";
import { extractConventions } from "../src/core/pipeline.js";

const fixtures = [
  "ts-react-vitest",
  "ts-express-jest",
  "go-project",
  "rust-project",
] as const;

function fixturePath(name: string): string {
  return resolve(import.meta.dirname, "fixtures", name);
}

describe("extractConventions performance", () => {
  for (const name of fixtures) {
    bench(name, async () => {
      await extractConventions(fixturePath(name));
    });
  }

  bench("all fixtures combined", async () => {
    for (const name of fixtures) {
      await extractConventions(fixturePath(name));
    }
  });
});
