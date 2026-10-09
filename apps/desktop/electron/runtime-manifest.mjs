// Shared packaging/startup contract for a complete desktop application.
export function runtimeManifestFiles(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.present !== true || manifest.layout !== 'app-owned') return null
  const caps = manifest.capabilities || {}
  const windows = String(manifest.pythonExecutable || '').endsWith('.exe')
  const files = [
    manifest.pythonExecutable,
    'work4you/work4you_cli/main.py',
    manifest.interfaces?.tui,
    manifest.interfaces?.web,
    caps.browser?.command,
    caps.browser?.executable,
    caps.computerUse?.command,
    caps.ffmpeg?.command,
    caps.voice?.modelFile,
    ...['melspectrogramOnnx', 'embeddingOnnx', 'melspectrogramTflite', 'embeddingTflite', 'sherpaTokens'].map(
      key => caps.wake?.[key]
    ),
    windows ? 'node/node.exe' : 'node/bin/node',
    windows ? 'bin/uv.exe' : 'bin/uv',
    windows ? 'bin/rg.exe' : 'bin/rg',
    windows ? 'bin/work4you.cmd' : 'bin/work4you',
    ...(windows ? [caps.git?.command, caps.shell?.command, caps.cppRuntime?.msvcp] : [])
  ]
  if (caps.browserUse?.module !== 'browser_harness.run') return null
  if (
    files.some(
      file =>
        typeof file !== 'string' ||
        !file ||
        file.startsWith('/') ||
        file.startsWith('\\') ||
        /^[a-z]:/i.test(file) ||
        file.split(/[\\/]/).includes('..')
    )
  )
    return null
  return files
}
