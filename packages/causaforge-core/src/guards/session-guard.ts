export function isIndependentReviewSession(builderSessionId: string | null, reviewerSessionId: string): boolean {
  return builderSessionId === null || builderSessionId !== reviewerSessionId
}
