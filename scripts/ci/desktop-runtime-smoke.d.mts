export interface RuntimeEvidence {
  layout: string
  root: string
  pythonExecutable: string
  work4youHome: string
  commit: string
}

export function samePath(actual: unknown, expected: string): boolean
export function validateRuntime(runtime: RuntimeEvidence, expected: { bundle: string; home: string; commit: string }): void
export function seedData(home: string): void
export function verifyPreservedFiles(home: string): void
export function probe(options: {
  executable: string
  home: string
  userData: string
  expectedCommit?: string
  seedSession?: boolean
}): Promise<Record<string, unknown>>
