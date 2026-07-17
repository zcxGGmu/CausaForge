# Stage 15 QA Summary

- `svg-xml.txt`: `docs/diagrams/causaforge-iterative-agent-loop.svg` parses as valid XML.
- `png-render.txt`: rendered PNG exists at 1200x760.
- Visual QA: manually inspected `docs/diagrams/causaforge-iterative-agent-loop.png`; the new `iteration > max_iterations` guard is readable, stays inside the patch production section, and does not overlap arrows, nodes, labels, or section borders.
- `readme-links.txt`: README and README.zh-CN local links and image paths resolve.
- `tools-test.txt`: targeted workflow tools test passed, including `MAX_ITERATIONS_EXCEEDED` before command execution.
- `test.txt`: `bun test packages/causaforge-core/src packages/causaforge-opencode/src` passed with 96 tests and 0 failures.
- `typecheck.txt`: root, core, and OpenCode adapter TypeScript checks passed.
- `build.txt`: `bun run build` completed successfully.
- `diff-check.txt`: `git diff --check` returned no whitespace errors.
- `strict-legacy-scan.txt`: strict legacy identifier scan returned zero matches.
