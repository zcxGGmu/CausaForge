#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

if (!existsSync(cliPath)) {
  console.error("causaforge: compiled CLI not found. Run `bun run build` first.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.signal) {
  const signalCodeByName = { SIGINT: 2, SIGTERM: 15, SIGKILL: 9 };
  process.exit(128 + (signalCodeByName[result.signal] ?? 1));
}

process.exit(result.status ?? 1);
