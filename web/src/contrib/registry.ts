import { atom } from 'nanostores'

import type { Contribution } from './types'

/** Bumped on registry mutation — web stub matches desktop API surface. */
export const $registryVersion = atom(0)

const EMPTY: readonly Contribution[] = Object.freeze([])

type Listener = () => void

class ContributionRegistry {
  getArea = (_area: string): readonly Contribution[] => EMPTY

  register = (_c: Contribution): (() => void) => () => {}

  registerMany = (_cs: Contribution[]): (() => void) => () => {}

  subscribe = (_fn: Listener): (() => void) => () => {}

  subscribeArea = (_area: string, _fn: Listener): (() => void) => () => {}
}

export const registry = new ContributionRegistry()
