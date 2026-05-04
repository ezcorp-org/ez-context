import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "bench/*.test.ts"],
    exclude: ["bench/fixtures/**"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
    },
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
  },
});
