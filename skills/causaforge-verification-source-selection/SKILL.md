---
name: causaforge-verification-source-selection
description: Use in CausaForge/OpenCode after patch-builder records a ready patch-candidate and before regression-verifier calls workflow_run_verification. Requires selecting the verification test source as either the current software's official test suite or a concrete user-provided test path, records a verification-source artifact through workflow_prepare_verification_source, and then drives multi-round verification feedback with the returned manifest.
---

# CausaForge Verification Source Selection

## Overview

Require an explicit test-source decision before CausaForge verification starts. Treat this as a hard workflow gate, not advisory prompt text: `workflow_run_verification` must only receive the manifest returned by `workflow_prepare_verification_source`.

## Workflow

Complete these steps after `patch-builder` has recorded a `patch-candidate` and before the first verification run.

1. Call `workflow_prepare_verification_source({ workflowId })` without `mode`.
2. Ask the user to choose exactly one source:
   - `official`: OpenCode uses the current software's official upstream test suite.
   - `user`: the user provides a concrete local test program path.
3. If the user chooses `official`:
   - Confirm repository preparation is ready. If it is pending or missing, call `workflow_prepare_repository` and ask the user to choose manual or OpenCode-managed checkout.
   - Explore the prepared checkout for the official tests that cover the patch plan and root-cause verification criteria.
   - Call `workflow_prepare_verification_source({ workflowId, mode: "official", suitePath })` with a suite path inside the prepared checkout.
4. If the user chooses `user`:
   - Ask for one concrete `testPath`.
   - Do not accept vague descriptions, missing paths, `.workflow` artifact paths, or paths outside the project/product root.
   - Call `workflow_prepare_verification_source({ workflowId, mode: "user", testPath })`.
5. Run `workflow_run_verification` only with the returned `manifest`.
6. Preserve the selected source across repair iterations while the active patch plan is unchanged. If the patch plan changes or the user asks to switch sources, repeat this workflow.

## Iteration Rules

- On verification failure, record the failed verification evidence, return to `building`, let `patch-builder` produce a new `patch-candidate`, then run the next iteration with the same prepared manifest.
- On manifest/source mismatch, stop and re-run `workflow_prepare_verification_source` instead of editing the manifest by hand.
- On official source selection without a ready repository checkout, block verification until repository preparation succeeds.
- On user source selection without a valid path, ask for the missing path and do not run verification.

## Done Criteria

- A `verification-source` artifact exists for the active patch plan.
- The artifact source is either `official` or `user`, and its manifest source matches that decision.
- `workflow_run_verification` uses the returned manifest unchanged.
- Each failed or passing verification run is preserved as the normal CausaForge iteration evidence.
