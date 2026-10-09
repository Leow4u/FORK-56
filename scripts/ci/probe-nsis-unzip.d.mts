export interface ProbeObservation {
  expected: 'success' | 'failure'
  exitCode: number | null
  exited: boolean
  timedOut: boolean
  sentinel: boolean
  integrity: boolean
  faultEstablished?: boolean
  harnessError?: string | null
}
export interface FixtureFile {
  name: string
  contents: string
}
export const pause: (milliseconds: number) => Promise<void>
export const pythonHelper: string
export function nsisString(value: string): string
export function run(command: string, args: string[], options?: import('node:child_process').SpawnSyncOptionsWithStringEncoding): import('node:child_process').SpawnSyncReturns<string>
export function compileHarness(options: {
  output: string; archive: string; template: string; plugins: string
  compiler: { path: string; env?: NodeJS.ProcessEnv }
  format?: 'zip' | '7z'; extraScript?: string
}): string
export interface NativeInstallerObservation {
  exitCode: number | null; exited: boolean; timedOut: boolean; durationMs: number
  dialogs: unknown[]; dialogError: string | null
  termination: { exitCode: number | null; error: string | null } | null
  stdout: string; stderr: string; harnessError: string | null
}
export function observeInstaller(executable: string, destination: string, marker: string,
  python: string, helper: string, timeoutMs: number): Promise<NativeInstallerObservation>
export function holdFile(python: string, helper: string, file: string, directory: string): Promise<{
  finish(): Promise<void>; stillHeld(): boolean; evidence: { pid: number; exclusive: boolean }
}>
export function inspectFixture(destination: string, entries: FixtureFile[]): Array<{
  name: string
  expectedSha256: string
  actualSha256: string | null
  matches: boolean
  error?: string
}>
export function assessResults(cases: ProbeObservation[]): { conclusive: boolean; readyForProduction: boolean }
export function probe(options: { out: string; python?: string; timeoutMs?: number }): Promise<{
  schemaVersion: number
  cases: ProbeObservation[]
  conclusive: boolean
  readyForProduction: boolean
  harnessError?: string
}>
