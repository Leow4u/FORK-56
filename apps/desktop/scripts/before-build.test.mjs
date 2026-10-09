import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'

import { ensureRuntimeResourceDir } from './before-build.mjs'

test('packaging requires a complete runtime and never creates a fallback stub', () => {
  const desktop = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-before-build-'))
  try {
    assert.throws(() => ensureRuntimeResourceDir(desktop), /Build the desktop runtime/)
    assert.equal(fs.existsSync(path.join(desktop, 'build')), false)
    const runtime = path.join(desktop, 'build', 'runtime')
    fs.mkdirSync(runtime, { recursive: true })
    fs.writeFileSync(path.join(runtime, 'manifest.json'), JSON.stringify({ schemaVersion: 1, present: false }))
    assert.throws(() => ensureRuntimeResourceDir(desktop), /complete app-owned runtime/)
  } finally {
    fs.rmSync(desktop, { recursive: true, force: true })
  }
})

test('packaging reads a relocated runtime without writing to it', () => {
  const desktop = fs.mkdtempSync(path.join(os.tmpdir(), 'work4you-before-build-'))
  try {
    const runtime = path.join(desktop, 'build', 'runtime')
    fs.mkdirSync(path.join(runtime, 'python'), { recursive: true })
    fs.mkdirSync(path.join(runtime, 'work4you', 'work4you_cli'), { recursive: true })
    fs.writeFileSync(path.join(runtime, 'python', 'python.exe'), 'fixture')
    fs.writeFileSync(path.join(runtime, 'work4you', 'work4you_cli', 'main.py'), '')
    const files = {
      pythonExecutable: 'python/python.exe',
      interfaces: { tui: 'tui/entry.js', web: 'web/index.html' },
      capabilities: {
        browser: { command: 'browser/agent-browser.exe', executable: 'browser/chrome.exe' },
        browserUse: { module: 'browser_harness.run' },
        computerUse: { command: 'cua/cua.exe' },
        ffmpeg: { command: 'bin/ffmpeg.exe' },
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
    const paths = [
      'tui/entry.js',
      'web/index.html',
      'browser/agent-browser.exe',
      'browser/chrome.exe',
      'cua/cua.exe',
      'bin/ffmpeg.exe',
      'voice/model.bin',
      'wake/mel.onnx',
      'wake/embedding.onnx',
      'wake/mel.tflite',
      'wake/embedding.tflite',
      'wake/tokens.txt',
      'node/node.exe',
      'bin/uv.exe',
      'bin/rg.exe',
      'bin/work4you.cmd',
      'git/cmd/git.exe',
      'git/bin/bash.exe',
      'python/msvcp140.dll'
    ]
    for (const filename of paths) {
      const file = path.join(runtime, filename)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, 'fixture')
    }
    const manifest = JSON.stringify({ schemaVersion: 1, present: true, layout: 'app-owned', ...files })
    fs.writeFileSync(path.join(runtime, 'manifest.json'), manifest)
    assert.deepEqual(ensureRuntimeResourceDir(desktop), { runtimeDir: runtime, present: true })
    assert.equal(fs.readFileSync(path.join(runtime, 'manifest.json'), 'utf8'), manifest)
    fs.rmSync(path.join(runtime, 'python', 'msvcp140.dll'))
    assert.throws(() => ensureRuntimeResourceDir(desktop), /complete app-owned runtime/)
    fs.writeFileSync(path.join(runtime, 'python', 'msvcp140.dll'), 'fixture')
    fs.rmSync(path.join(runtime, 'voice', 'model.bin'))
    assert.throws(() => ensureRuntimeResourceDir(desktop), /complete app-owned runtime/)
  } finally {
    fs.rmSync(desktop, { recursive: true, force: true })
  }
})
