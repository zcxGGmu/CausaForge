import {
  renderDeliveryMarkdown,
  renderPatchPlanMarkdown,
  renderReviewMarkdown,
  renderRootCauseMarkdown,
  renderVerificationMarkdown,
  type ArtifactKind,
} from "@causaforge/core"

export function renderArtifactMarkdown(artifactKind: ArtifactKind, artifact: unknown): string | null {
  switch (artifactKind) {
    case "root-cause":
      return renderRootCauseMarkdown(artifact)
    case "patch-plan":
      return renderPatchPlanMarkdown(artifact)
    case "verification":
      return renderVerificationMarkdown(artifact)
    case "review":
      return renderReviewMarkdown(artifact)
    case "delivery":
      return renderDeliveryMarkdown(artifact)
    case "patch-candidate":
      return null
  }
}
