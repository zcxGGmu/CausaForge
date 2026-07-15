export function parseChangedFilesFromDiff(diff: string): string[] {
  const files = new Set<string>()
  for (const match of diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
    const nextPath = match[2]
    if (nextPath && nextPath !== "/dev/null") files.add(nextPath)
  }
  return [...files]
}
