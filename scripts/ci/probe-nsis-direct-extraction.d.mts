import type { NativeInstallerObservation } from './probe-nsis-unzip.mjs'

export interface ExtractionAttempt { attempt: number; status: string }
export interface DirectObservation extends NativeInstallerObservation {
  name: string
  expected: 'success' | 'failure'
  sentinel: boolean
  integrity: boolean
  attempts: ExtractionAttempt[]
  faultEstablished?: boolean
  holderAliveAfterFailure?: boolean
  originalBytesUnchanged?: boolean
  failedWhileHeld?: boolean
  releaseDelayMs?: number
  archiveRejectedByTool?: boolean
}
export function parseAttemptTrace(text: string): ExtractionAttempt[]
export function assessDirectResults(cases: DirectObservation[]): {
  conclusive: boolean; candidatePassed: boolean; checks: Record<string, boolean>
}
export function probeDirect(options: { out: string; python?: string; timeoutMs?: number }): Promise<{
  schemaVersion: number; cases: DirectObservation[]
  productionHookPatchApplied: boolean
  conclusive: boolean; candidatePassed: boolean; harnessError?: string
}>
