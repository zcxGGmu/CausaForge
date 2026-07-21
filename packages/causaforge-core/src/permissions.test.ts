import { describe, expect, test } from "bun:test"
import { canModifyProductCode, canWriteArtifact } from "./permissions"

describe("workflow permissions", () => {
  test("limits product code modifications to the patch builder", () => {
    expect(canModifyProductCode("patch-builder")).toBe(true)
    expect(canModifyProductCode("regression-verifier")).toBe(false)
    expect(canModifyProductCode("patch-reviewer")).toBe(false)
  })

  test("limits artifact writes to the owning workflow agent", () => {
    expect(canWriteArtifact("root-cause-analyst", "root-cause")).toBe(true)
    expect(canWriteArtifact("patch-planner", "patch-plan")).toBe(true)
    expect(canWriteArtifact("patch-builder", "patch-candidate")).toBe(true)
    expect(canWriteArtifact("regression-verifier", "verification-source")).toBe(true)
    expect(canWriteArtifact("regression-verifier", "verification")).toBe(true)
    expect(canWriteArtifact("patch-reviewer", "review")).toBe(true)
    expect(canWriteArtifact("delivery-coordinator", "delivery")).toBe(true)

    expect(canWriteArtifact("patch-planner", "patch-candidate")).toBe(false)
    expect(canWriteArtifact("workflow-orchestrator", "root-cause")).toBe(false)
  })
})
