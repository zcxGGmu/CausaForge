import type { ZodType } from "zod"
import {
  DeliveryArtifactSchema,
  PatchCandidateArtifactSchema,
  PatchPlanArtifactSchema,
  ReviewArtifactSchema,
  RootCauseArtifactSchema,
  VerificationArtifactSchema,
  type ArtifactBase,
} from "../schemas"
import type { ArtifactKind } from "./paths"

const ARTIFACT_SCHEMAS: Record<ArtifactKind, ZodType> = {
  "root-cause": RootCauseArtifactSchema,
  "patch-plan": PatchPlanArtifactSchema,
  "patch-candidate": PatchCandidateArtifactSchema,
  verification: VerificationArtifactSchema,
  review: ReviewArtifactSchema,
  delivery: DeliveryArtifactSchema,
}

export function parseArtifact(kind: ArtifactKind, value: unknown): ArtifactBase {
  return ARTIFACT_SCHEMAS[kind].parse(value) as ArtifactBase
}
