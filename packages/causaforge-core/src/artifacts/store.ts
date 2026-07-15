import fs from "node:fs/promises"
import path from "node:path"
import { WorkflowStateSchema, type WorkflowState } from "../schemas"
import { ARTIFACT_ROOT_DIR, getArtifactPath, getWorkflowDir, getWorkflowStatePath, type ArtifactKind } from "./paths"
import { parseArtifact } from "./validators"

export interface WorkflowArtifactStore {
  initializeWorkflow(state: WorkflowState): Promise<void>
  listWorkflows(): Promise<WorkflowState[]>
  readWorkflow(workflowId: string): Promise<WorkflowState>
  writeWorkflow(state: WorkflowState): Promise<void>
  readArtifact<T = unknown>(workflowId: string, kind: ArtifactKind): Promise<T>
  writeArtifact<T = unknown>(workflowId: string, kind: ArtifactKind, value: T): Promise<string>
  artifactExists(workflowId: string, kind: ArtifactKind): Promise<boolean>
}

export function createWorkflowArtifactStore(baseDir: string): WorkflowArtifactStore {
  return {
    async initializeWorkflow(state) {
      const parsed = WorkflowStateSchema.parse(state)
      await writeJsonAtomic(getWorkflowStatePath(baseDir, parsed.workflowId), parsed)
    },

    async listWorkflows() {
      const rootDir = path.join(baseDir, ARTIFACT_ROOT_DIR)
      let entries: Array<{ name: string; isDirectory(): boolean }>
      try {
        entries = await fs.readdir(rootDir, { withFileTypes: true })
      } catch (error) {
        if (isMissingPathError(error)) return []
        throw error
      }

      const workflows: WorkflowState[] = []
      for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
        workflows.push(await this.readWorkflow(entry.name))
      }
      return workflows
    },

    async readWorkflow(workflowId) {
      const value = await readJson(getWorkflowStatePath(baseDir, workflowId))
      return WorkflowStateSchema.parse(value)
    },

    async writeWorkflow(state) {
      const parsed = WorkflowStateSchema.parse(state)
      await writeJsonAtomic(getWorkflowStatePath(baseDir, parsed.workflowId), parsed)
    },

    async readArtifact<T = unknown>(workflowId: string, kind: ArtifactKind) {
      const value = await readJson(getArtifactPath(baseDir, workflowId, kind))
      const parsed = parseArtifact(kind, value)
      assertArtifactWorkflowId(workflowId, kind, parsed.workflowId)
      return parsed as T
    },

    async writeArtifact<T = unknown>(workflowId: string, kind: ArtifactKind, value: T) {
      const parsed = parseArtifact(kind, value)
      assertArtifactWorkflowId(workflowId, kind, parsed.workflowId)
      const filePath = getArtifactPath(baseDir, workflowId, kind)
      await writeJsonAtomic(filePath, parsed)
      return filePath
    },

    async artifactExists(workflowId: string, kind: ArtifactKind) {
      try {
        await fs.access(getArtifactPath(baseDir, workflowId, kind))
        return true
      } catch {
        return false
      }
    },
  }
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"))
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`)
  await fs.rename(tempPath, filePath)
}

function assertArtifactWorkflowId(workflowId: string, kind: ArtifactKind, artifactWorkflowId: string): void {
  if (artifactWorkflowId !== workflowId) {
    throw new Error(`Artifact ${kind} workflowId ${artifactWorkflowId} does not match target workflow ${workflowId}`)
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

export { getArtifactPath, getWorkflowDir, getWorkflowStatePath }
