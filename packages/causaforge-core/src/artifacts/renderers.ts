import {
  DeliveryArtifactSchema,
  PatchPlanArtifactSchema,
  ReviewArtifactSchema,
  RootCauseArtifactSchema,
  VerificationArtifactSchema,
} from "../schemas"

export function renderRootCauseMarkdown(input: unknown): string {
  const artifact = RootCauseArtifactSchema.parse(input)
  return [
    `# Root Cause ${artifact.artifactId}`,
    "",
    `Status: ${artifact.status}`,
    "",
    `Problem: ${artifact.problemSummary}`,
    "",
    `Root Cause: ${artifact.rootCauseSummary}`,
    "",
    "Verification Criteria:",
    ...artifact.verificationCriteria.map((criterion) => `- ${criterion.criterionId}: ${criterion.description}`),
  ].join("\n")
}

export function renderPatchPlanMarkdown(input: unknown): string {
  const artifact = PatchPlanArtifactSchema.parse(input)
  return [
    `# Patch Plan ${artifact.artifactId}`,
    "",
    `Status: ${artifact.status}`,
    "",
    "Objectives:",
    ...artifact.objectives.map((objective) => `- ${objective}`),
    "",
    "File Changes:",
    ...artifact.fileChanges.map((change) => `- ${change.path}: ${change.change}`),
  ].join("\n")
}

export function renderVerificationMarkdown(input: unknown): string {
  const artifact = VerificationArtifactSchema.parse(input)
  return [
    `# Verification ${artifact.artifactId}`,
    "",
    `Status: ${artifact.status}`,
    "",
    "Commands:",
    ...artifact.commands.map((command) => `- ${command.command} -> ${command.exitCode}`),
    "",
    "Criteria:",
    ...artifact.criteria.map((criterion) => `- ${criterion.criterionId}: ${criterion.status}`),
  ].join("\n")
}

export function renderReviewMarkdown(input: unknown): string {
  const artifact = ReviewArtifactSchema.parse(input)
  return [
    `# Review ${artifact.artifactId}`,
    "",
    `Status: ${artifact.status}`,
    "",
    `Reviewer Session: ${artifact.reviewerSessionId}`,
    "",
    "Findings:",
    ...(artifact.findings.length === 0
      ? ["- none"]
      : artifact.findings.map((finding) => `- ${finding.severity}: ${finding.summary}`)),
  ].join("\n")
}

export function renderDeliveryMarkdown(input: unknown): string {
  const artifact = DeliveryArtifactSchema.parse(input)
  return [
    `# Delivery ${artifact.artifactId}`,
    "",
    `Status: ${artifact.status}`,
    "",
    `Fix: ${artifact.fixSummary}`,
    "",
    `Verification: ${artifact.verificationSummary}`,
    "",
    `Review: ${artifact.reviewSummary}`,
  ].join("\n")
}
