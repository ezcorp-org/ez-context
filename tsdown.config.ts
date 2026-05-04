import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  sourcemap: true,
  target: "node20",
  outDir: "dist",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
