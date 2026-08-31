import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, it } from 'vitest'

import { tablerIconsReactStaticEntry } from './tabler-icons-entry'

const require = createRequire(import.meta.url)

describe('tablerIconsReactStaticEntry', () => {
  it('joins dist/esm/icons/index.mjs onto the package root', () => {
    const pkgJson = path.join('pkg-root', 'package.json')
    assert.equal(
      tablerIconsReactStaticEntry(pkgJson),
      path.join('pkg-root', 'dist', 'esm', 'icons', 'index.mjs')
    )
  })

  it('points at the same-folder icon barrel that exists on disk', () => {
    const pkgJson = require.resolve('@tabler/icons-react/package.json')
    const entry = tablerIconsReactStaticEntry(pkgJson)
    assert.equal(existsSync(entry), true)
    const src = readFileSync(entry, 'utf8')
    assert.match(src, /from '\.\/IconNumber123\.mjs'/)
    assert.doesNotMatch(src, /from '\.\/icons\/IconNumber123/)
  })
})
