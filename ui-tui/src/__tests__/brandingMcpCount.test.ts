import { PassThrough } from 'stream'

import { renderSync } from '@work4you/ink'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { SessionPanel } from '../components/branding.js'
import { DEFAULT_THEME } from '../theme.js'
import type { McpServerStatus, SessionInfo } from '../types.js'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const makeStreams = (columns = 100) => {
  const stdout = new PassThrough()
  const stdin = new PassThrough()
  const stderr = new PassThrough()

  Object.assign(stdout, { columns, isTTY: false, rows: 40 })
  Object.assign(stdin, { isTTY: false })
  Object.assign(stderr, { isTTY: false })

  let captured = ''
  stdout.on('data', chunk => {
    captured += chunk.toString()
  })

  return { capture: () => captured, stderr, stdin, stdout }
}

const mcp = (over: Partial<McpServerStatus> & Pick<McpServerStatus, 'name'>): McpServerStatus => ({
  connected: false,
  tools: 0,
  transport: 'http',
  ...over
})

const baseInfo = (over: Partial<SessionInfo> = {}): SessionInfo => ({
  cwd: '/tmp/project',
  mcp_servers: [
    mcp({ connected: true, name: 'work4you-support', status: 'connected', tools: 6 }),
    mcp({ connected: false, disabled: true, name: 'linear', status: 'disabled' })
  ],
  model: 'anthropic/test-model',
  skills: { core: ['a', 'b'] },
  tools: { file: ['read_file', 'write_file'] },
  version: '0.20.4',
  ...over
})

async function renderSplash(info: SessionInfo): Promise<string> {
  const streams = makeStreams()

  const instance = renderSync(React.createElement(SessionPanel, { info, sid: 'sess-test', t: DEFAULT_THEME }), {
    patchConsole: false,
    stderr: streams.stderr as NodeJS.WriteStream,
    stdin: streams.stdin as NodeJS.ReadStream,
    stdout: streams.stdout as NodeJS.WriteStream
  })

  try {
    await delay(20)

    // eslint-disable-next-line no-control-regex
    return streams.capture().replace(/\u001b\[[0-9;]*m/g, '')
  } finally {
    instance.unmount()
    instance.cleanup()
  }
}

describe('TUI splash SessionPanel', () => {
  it('shows session facts and hides the tools/skills/MCP catalog', async () => {
    const frame = await renderSplash(baseInfo())

    expect(frame).toContain('test-model')
    expect(frame).toContain('/tmp/project')
    expect(frame).toContain('Session:')
    expect(frame).toContain('sess-test')
    expect(frame).toContain('/help for commands')
    expect(frame).not.toContain('Available Tools')
    expect(frame).not.toContain('Available Skills')
    expect(frame).not.toContain('MCP Servers')
    expect(frame).not.toContain('read_file')
    expect(frame).not.toMatch(/\d MCP\b/)
    expect(frame).not.toContain('Messenger of the Digital Gods')
    expect(frame).not.toContain('HERMES')
  })

  it('shows Operis 4.0 Flash instead of the house-model wire id', async () => {
    for (const model of ['google/gemini-3.8-flash', 'deepseek/deepseek-v4-flash-0731']) {
      const frame = await renderSplash(baseInfo({ model }))

      expect(frame).toContain('Operis 4.0 Flash')
      expect(frame).not.toContain('gemini-3.8-flash')
      expect(frame).not.toContain('deepseek-v4-flash-0731')
      expect(frame).not.toContain('deepseek-v4-flash')
    }
  })

  it('does not dump skill names from session info', async () => {
    const frame = await renderSplash(baseInfo({ skills: { research: ['auth', 'vault'] } }))

    expect(frame).not.toContain('auth')
    expect(frame).not.toContain('vault')
    expect(frame).toContain('test-model')
  })
})
