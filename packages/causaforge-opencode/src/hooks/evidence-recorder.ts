export interface CommandEvidenceInput {
  workflowId: string
  command: string
  exitCode: number
  startedAt: string
  completedAt: string
  outputSummary: string
}

export interface CommandEvidence {
  workflowId: string
  status: "draft"
  verificationStatus: null
  command: string
  exitCode: number
  startedAt: string
  completedAt: string
  outputSummary: string
}

export function recordCommandEvidence(input: CommandEvidenceInput): CommandEvidence {
  return {
    workflowId: input.workflowId,
    status: "draft",
    verificationStatus: null,
    command: input.command,
    exitCode: input.exitCode,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    outputSummary: input.outputSummary,
  }
}
