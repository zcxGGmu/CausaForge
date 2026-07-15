# Stage 5 QA Summary

## What Was Tested

- Isolated OpenCode config loading with the local CausaForge plugin entry.
- Isolated OpenCode server startup and HTTP API visibility for configuration and tool IDs.
- Production workflow tool chain through `workflow_start`, artifact recording, phase transitions, git diff capture, verification, review, delivery, and completion.
- Tool permission behavior during building phase, including allowed plan-scoped edit and rejected out-of-scope edit.
- Automated regression suite, typecheck, build, whitespace diff check, and strict old-identifier scan.

## What Was Observed

- `opencode debug config` loads the plugin and injects all 7 normalized workflow agents.
- `opencode serve` reports healthy OpenCode 1.17.13; `/config` contains CausaForge agents and `/experimental/tool/ids` exposes all 8 workflow tools.
- Live OpenCode DB session count stayed unchanged before and after server QA: `280 -> 280`.
- Full production tool-chain run completed `wf-real-001` with no missing gates, generated a real `patch.diff`, and copied final workflow artifacts to `tool-chain-workflow/`.
- A real issue was found and fixed: building-phase write permission could not resolve the active workflow before builder session binding; the hook now safely falls back only when there is exactly one active workflow.
- Final automation results: 89 tests passed, typecheck passed, build passed, `git diff --check` passed, strict old-identifier scan returned zero matches.

## Why This Is Enough

- The OpenCode host was exercised through both CLI config loading and a live server API, proving plugin load and exposed tool surface in the real host rather than only unit tests.
- The production PluginModule tool wrappers were used for the workflow chain, covering the same tool definitions that OpenCode exposes.
- The failing real workflow condition was reproduced before the fix and is now covered by a regression test plus the full tool-chain run.
- Evidence includes host logs, API responses, generated workflow artifacts, final test logs, and strict identifier scan output.

## What Was Omitted

- No real LLM completion was run; workflow correctness was validated deterministically through host loading, host API visibility, and production tool execution to avoid nondeterministic model behavior.
- Raw temporary absolute paths and auth password were redacted from evidence files.
- Fully replacing HOME was tested but not used as the canonical QA mode because this local OpenCode build stalls plugin resolution under a completely empty HOME; the canonical QA uses isolated XDG paths and verifies the real DB count is unchanged.
