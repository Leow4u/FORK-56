import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, test } from 'vitest'

import {
  appOwnedRuntimeBackend,
  bundledRuntimeDir,
  parseBundledRuntimeManifest,
  resolveAppOwnedRuntime
} from './bundled-runtime'

function manifestFor(pythonExecutable: string) {
  return {
    schemaVersion: 1,
    present: true,
    layout: 'app-owned',
    pythonExecutable,
    interfaces: { tui: 'tui/entry.js', web: 'web/index.html' },
    capabilities: {
      browser: { command: 'browser/agent-browser', executable: 'browser/chrome' },
      browserUse: { module: 'browser_harness.run' },
      computerUse: { command: 'cua/cua' },
      ffmpeg: { command: 'bin/ffmpeg' },
      voice: { modelFile: 'voice/model.bin' },
      wake: {
        melspectrogramOnnx: 'wake/mel.onnx',
        embeddingOnnx: 'wake/embedding.onnx',
        melspectrogramTflite: 'wake/mel.tflite',
        embeddingTflite: 'wake/embedding.tflite',
        sherpaTokens: 'wake/tokens.txt'
      },
      git: { command: 'git/cmd/git.exe' },
      shell: { command: 'git/bin/bash.exe' },
      cppRuntime: { msvcp: 'python/msvcp140.dll' }
    }
  }
}

describe('app-owned runtime', () => {
  test('a packaged app cannot silently fall back to an older HOME installation', () => {
    for (const manifest of [null, { schemaVersion: 1, present: false }, { schemaVersion: 1, present: true }]) {
      assert.throws(
        () =>
          resolveAppOwnedRuntime({
            manifest,
            bundleDir: '/resources/runtime',
            isPackaged: true,
            platform: 'darwin',
            fileExists: () => true
          }),
        /runtime is incomplete/
      )
      assert.equal(
        resolveAppOwnedRuntime({ manifest, bundleDir: null, isPackaged: false, fileExists: () => false }),
        null
      )
    }
  })

  test('resolves a relocated bundle from real files without copying it into the data HOME', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you app runtime '))
    try {
      const bundleDir = path.join(root, 'resources', 'runtime')
      const code = path.join(bundleDir, 'work4you', 'work4you_cli')
      const python = path.join(bundleDir, 'python', 'bin', 'python3')
      fs.mkdirSync(code, { recursive: true })
      fs.mkdirSync(path.dirname(python), { recursive: true })
      fs.writeFileSync(python, 'fixture')
      fs.writeFileSync(path.join(code, 'main.py'), '')
      const manifest = { ...manifestFor('python/bin/python3'), commit: 'abc' }
      for (const filename of [
        'tui/entry.js',
        'web/index.html',
        'browser/agent-browser',
        'browser/chrome',
        'cua/cua',
        'bin/ffmpeg',
        'voice/model.bin',
        'wake/mel.onnx',
        'wake/embedding.onnx',
        'wake/mel.tflite',
        'wake/embedding.tflite',
        'wake/tokens.txt',
        'node/bin/node',
        'bin/uv',
        'bin/rg',
        'bin/work4you'
      ]) {
        const file = path.join(bundleDir, filename)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, 'fixture')
      }
      const runtime = resolveAppOwnedRuntime({
        bundleDir,
        manifest,
        isPackaged: true,
        platform: 'darwin',
        fileExists: fs.existsSync
      })!
      assert.equal(runtime.pythonExecutable, python)
      const dataHome = path.join(root, 'custom-data')
      const backend = appOwnedRuntimeBackend({
        runtime,
        work4youHome: dataHome,
        appExecutable: '/Applications/Work4You.app/Contents/MacOS/Work4You',
        args: ['--profile', 'ada', 'serve'],
        platform: 'darwin',
        currentEnv: {
          PATH: '/usr/bin',
          PYTHONPATH: '/unrelated/checkout',
          VIRTUAL_ENV: '/unrelated/venv',
          PYTHONHOME: '/unrelated/python'
        }
      })
      assert.equal(backend.bootstrap, false)
      assert.equal(backend.command, python)
      assert.deepEqual(backend.args, ['-m', 'work4you_cli.main', '--profile', 'ada', 'serve'])
      assert.equal(backend.env.WORK4YOU_HOME, dataHome)
      assert.equal(backend.env.PYTHONPATH, path.join(bundleDir, 'work4you'))
      assert.equal(backend.env.VIRTUAL_ENV, '')
      assert.equal(backend.env.PYTHONHOME, '')
      assert.equal(backend.env.PYTHONDONTWRITEBYTECODE, '1')
      assert.equal(backend.env.PYTHONNOUSERSITE, '1')
      assert.ok(backend.env.PATH.startsWith(path.join(bundleDir, 'node', 'bin')))
      assert.equal(fs.existsSync(dataHome), false)
      fs.rmSync(path.join(bundleDir, 'browser', 'chrome'))
      assert.throws(
        () =>
          resolveAppOwnedRuntime({
            bundleDir,
            manifest,
            isPackaged: true,
            platform: 'darwin',
            fileExists: fs.existsSync
          }),
        /runtime is incomplete/
      )
      fs.rmSync(python)
      assert.throws(
        () =>
          resolveAppOwnedRuntime({
            bundleDir,
            manifest,
            isPackaged: true,
            platform: 'darwin',
            fileExists: fs.existsSync
          }),
        /runtime is incomplete/
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('Windows paths and custom HOME stay separate from application resources', () => {
    const runtime = resolveAppOwnedRuntime({
      bundleDir: 'C:\\Program Files\\Work4You\\resources\\runtime',
      manifest: manifestFor('python/python.exe'),
      isPackaged: true,
      platform: 'win32',
      fileExists: () => true
    })!
    const backend = appOwnedRuntimeBackend({
      runtime,
      work4youHome: 'D:\\Ada data\\work4you',
      appExecutable: 'C:\\Program Files\\Work4You\\Work4You.exe',
      args: ['serve'],
      platform: 'win32',
      currentEnv: { Path: 'C:\\Windows' }
    })
    assert.equal(runtime.pythonExecutable, 'C:\\Program Files\\Work4You\\resources\\runtime\\python\\python.exe')
    assert.equal(backend.env.WORK4YOU_HOME, 'D:\\Ada data\\work4you')
    assert.ok(backend.env.Path.startsWith('C:\\Program Files\\Work4You\\resources\\runtime\\node;'))
    for (const pythonExecutable of ['../python.exe', 'C:\\elsewhere\\python.exe', '/tmp/python']) {
      assert.throws(
        () =>
          resolveAppOwnedRuntime({
            bundleDir: runtime.bundleDir,
            manifest: manifestFor(pythonExecutable),
            isPackaged: true,
            platform: 'win32',
            fileExists: () => true
          }),
        /runtime is incomplete/
      )
    }
  })

  test('manifest version and resource root are validated', () => {
    assert.equal(parseBundledRuntimeManifest(null), null)
    assert.equal(parseBundledRuntimeManifest({ present: true }), null)
    assert.equal(bundledRuntimeDir(null), null)
    assert.equal(bundledRuntimeDir('C:/Work4You/resources'), 'C:/Work4You/resources/runtime')
  })
})
