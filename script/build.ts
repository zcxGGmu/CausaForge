#!/usr/bin/env bun
import { mkdir, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["packages/causaforge-opencode/src/index.ts", "packages/causaforge-opencode/src/cli.ts"],
  outdir: "dist",
  target: "bun",
  format: "esm",
  external: ["@opencode-ai/plugin", "zod"],
  sourcemap: "external",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await writeFile(
  "dist/index.d.ts",
  `export * from "../packages/causaforge-opencode/src/index"\n` +
    `export { default } from "../packages/causaforge-opencode/src/index"\n`,
);
