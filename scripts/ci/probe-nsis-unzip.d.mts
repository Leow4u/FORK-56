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
