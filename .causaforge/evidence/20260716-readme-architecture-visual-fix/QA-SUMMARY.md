# Stage 10 QA Summary

## Symptom

- User reported that the first README architecture diagram had overlapping text and graphics.
- Visual reproduction confirmed the issue: Adapter/Core layer subtitles were too close to the top nodes, and the Core Layer header area overlapped visually with the State Machine node.

## Root Cause

- `docs/diagrams/causaforge-architecture.svg` placed Adapter top node at `y=150` and Core top node at `y=135`, inside the layer header/subtitle visual band.
- Previous README verification checked link validity, SVG XML validity, PNG renderability, tests, and identifier scans, but did not include manual visual inspection of the rendered diagram.

## Fix

- Moved Adapter and Core nodes downward to start at `y=185`.
- Repositioned the affected arrows and line labels to match the new node coordinates.
- Re-rendered `docs/diagrams/causaforge-architecture.png` from the updated SVG at `2400x1520`.
- Added README visual QA lessons to `tasks/lessons.md`.

## Verification

- `before-architecture.png`: saved original overlapping render.
- `after-architecture.png`: saved fixed render.
- `manual-visual-check.txt`: recorded visual inspection confirming no remaining header/node overlap.
- `svg-render-check.txt`: SVG XML parsed successfully and PNG is readable at `2400x1520`.
- `layout-coordinate-check.txt`: top Adapter/Core nodes now start at `y=185`, below layer header/subtitle area.
- `readme-link-check.txt`: all README local links and image references resolved.
- `strict-legacy-identity-scan.txt`: no legacy/upstream identity strings found.
- `bun-test.txt`: `bun run test` passed 89 tests with 0 failures.
- `typecheck.txt`: `bun run typecheck` passed for root, core, and OpenCode adapter.
- `build.txt`: `bun run build` completed successfully.
- `diff-check.txt`: `git diff --check` passed.
