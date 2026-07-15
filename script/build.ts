#!/usr/bin/env bun
import { mkdir, rm, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const result = await Bun.build({
  entrypoints: ["packages/causaforge-opencode/src/index.ts"],
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

await writeFile(
  "dist/cli.js",
  `#!/usr/bin/env node\n` +
    `import { readFileSync } from "node:fs";\n` +
    `import { fileURLToPath } from "node:url";\n` +
    `const root = fileURLToPath(new URL("..", import.meta.url));\n` +
    `const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));\n` +
    `const arg = process.argv[2];\n` +
    `if (arg === "--version" || arg === "-v") { console.log(pkg.version); process.exit(0); }\n` +
    `console.log("CausaForge Agent " + pkg.version);\n` +
    `console.log("OpenCode plugin entry: " + root + "/dist/index.js");\n` +
    `console.log("Use this package as an OpenCode plugin module or import createPluginModule().");\n`,
);
