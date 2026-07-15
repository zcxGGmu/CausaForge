# Stage 6 QA Summary

## What Was Tested

- Project identity rename across package metadata, workspace paths, package scopes, CLI bin names, plugin id, source imports, docs, task records, and evidence root.
- Clean build behavior after adding a `dist` cleanup step and root `dist/index.d.ts` generation.
- Production entry shape from `dist/index.js` and CLI version output from `bin/causaforge.js`.
- Real OpenCode host loading through `opencode debug config` using the final `dist/index.js` plugin entry.
- Real OpenCode server API visibility for injected workflow agents and workflow tools.
- Strict scans for old project identity and old upstream product identifiers across repository content, lockfile, paths, and generated `dist`.

## What Was Observed

- Root package is now `causaforge-agent`; CLI bins are `causaforge` and `causaforge-agent`.
- Workspaces are now `packages/causaforge-core` and `packages/causaforge-opencode`; package scopes are `@causaforge/core` and `@causaforge/opencode-adapter`.
- Production PluginModule default export and factory both expose plugin id `causaforge-agent`.
- OpenCode 1.17.13 loaded the final plugin entry with exit code 0 and preserved the live DB session count: `280 -> 280`.
- OpenCode server API returned healthy status, 7 workflow agents in `/config`, and all 8 workflow tools in `/experimental/tool/ids`.
- Final automated checks passed: 89 tests, typecheck, build, production entry probe, `git diff --check`, old project-name scan, and old upstream-brand scan.

## Why This Is Enough

- The rename was validated at three layers: static repository scan, package/build surface, and real OpenCode host loading.
- The clean build scan included generated `dist`, preventing stale generated files from hiding old identifiers.
- OpenCode QA used isolated XDG paths and confirmed the real OpenCode DB session count did not change.

## What Was Omitted

- Git history and current filesystem parent paths were not rewritten; only project files, tracked paths, generated output, and evidence under the worktree were changed.
- No live LLM prompt was run; plugin host loading and tool/agent exposure were verified deterministically through OpenCode config and server APIs.
