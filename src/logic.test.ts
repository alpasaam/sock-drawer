import { describe, expect, it } from 'vitest'
import {
  SLOT_COUNT,
  countsAreEven,
  createLaundry,
  createOpeningLine,
  difficulty,
  helperIndex,
  inPlayEven,
  intakeSolvable,
  isIntakeMatch,
  pointsForCombo,
  prepareStep,
  repairIntake,
  retie,
  stepIsSavable,
  stepLaundry,
  swapAt,
  unsettle,
  type Rng,
  type Sock,
} from './logic.ts'

function rngFrom(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function patterns(line: readonly Sock[]): number[] {
  return line.map((sock) => sock.pattern)
}

describe('swapAt', () => {
  it('swaps neighbors and leaves the source line alone', () => {
    const line: Sock[] = [
      { id: 1, pattern: 0 },
      { id: 2, pattern: 1 },
      { id: 3, pattern: 0 },
    ]
    const next = swapAt(line, 0)
    expect(patterns(next)).toEqual([1, 0, 0])
    expect(patterns(line)).toEqual([0, 1, 0])
    expect(swapAt(line, -1)).toEqual(line)
    expect(swapAt(line, 2)).toEqual(line)
  })
})

describe('opening line', () => {
  it('starts with a matched pair already at the drawer', () => {
    const line = createOpeningLine(rngFrom(3), { next: 1 })
    expect(line).toHaveLength(SLOT_COUNT)
    expect(isIntakeMatch(line)).toBe(true)
    expect(countsAreEven(line)).toBe(true)
    expect(intakeSolvable(line, 3)).toBe(true)
  })
})

describe('repairIntake', () => {
  it('slides a far partner into the drawer window', () => {
    const line: Sock[] = [
      { id: 1, pattern: 2 },
      { id: 2, pattern: 0 },
      { id: 3, pattern: 1 },
      { id: 4, pattern: 1 },
      { id: 5, pattern: 0 },
      { id: 6, pattern: 2 },
    ]
    expect(intakeSolvable(line, 3)).toBe(false)
    const repaired = repairIntake(line, 3)
    expect(intakeSolvable(repaired, 3)).toBe(true)
    expect(repaired[5]?.pattern).toBe(2)
    expect(patterns(line)).toEqual([2, 0, 1, 1, 0, 2])
  })

  it('does not reshuffle a line that is already solvable', () => {
    const line: Sock[] = [
      { id: 1, pattern: 0 },
      { id: 2, pattern: 1 },
      { id: 3, pattern: 1 },
      { id: 4, pattern: 2 },
      { id: 5, pattern: 0 },
      { id: 6, pattern: 2 },
    ]
    expect(repairIntake(line, 4)).toEqual(line)
  })
})

describe('a long line of laundry', () => {
  it('steps in pairs a careful player can always fold', () => {
    const rng = rngFrom(11)
    const ids = { next: 1 }
    let state = createLaundry(rng, ids)
    let folds = 0
    let swaps = 0
    for (let beat = 0; beat < 48; beat++) {
      const diff = difficulty(folds)
      expect(state.line).toHaveLength(SLOT_COUNT)
      expect(inPlayEven(state)).toBe(true)
      expect(stepIsSavable(state, diff.window)).toBe(true)
      if (helperIndex(state.line) >= 0) swaps += 1
      state = prepareStep(state)
      const outcome = stepLaundry(state, diff.window, diff.patterns, rng, ids)
      expect(outcome.matched).toBe(true)
      expect(outcome.spawned[0]?.pattern).toBe(outcome.spawned[1]?.pattern)
      expect(outcome.state.line).toHaveLength(SLOT_COUNT)
      folds += 1
      state = outcome.state
    }
    expect(folds).toBe(48)
    expect(swaps).toBeGreaterThan(20)
  })
})

describe('difficulty', () => {
  it('starts generous and asks for more as pairs stack up', () => {
    const early = difficulty(0)
    const later = difficulty(24)
    expect(early.patterns).toBe(3)
    expect(early.window).toBe(3)
    expect(early.intervalMs).toBeGreaterThan(later.intervalMs)
    expect(later.patterns).toBe(6)
    expect(later.window).toBe(SLOT_COUNT)
    expect(later.intervalMs).toBeGreaterThanOrEqual(1100)
    expect(later.scramble).toBeGreaterThan(early.scramble)
  })
})

describe('deals that need a swap', () => {
  it('never hands over a pair that is already together', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const rng = rngFrom(seed)
      const ids = { next: 1 }
      const state = createLaundry(rng, ids)
      expect(isIntakeMatch(state.line)).toBe(false)
      expect(stepIsSavable(state, 3)).toBe(true)
      expect(helperIndex(state.line)).toBeGreaterThanOrEqual(0)
      expect(inPlayEven(state)).toBe(true)
    }
  })

  it('keeps a finished fold from setting up the next pair', () => {
    const rng = rngFrom(9)
    const ids = { next: 1 }
    const folded = stepLaundry(prepareStep(createLaundry(rng, ids)), 3, 3, rng, ids)
    expect(folded.matched).toBe(true)
    expect(isIntakeMatch(folded.state.line)).toBe(false)
    expect(stepIsSavable(folded.state, 3)).toBe(true)
    expect(helperIndex(folded.state.line)).toBeGreaterThanOrEqual(0)
    const next = stepLaundry(prepareStep(folded.state), 3, 3, rng, ids)
    expect(next.matched).toBe(true)
  })
})

describe('unsettle', () => {
  it('pulls an adjacent partner back into the window', () => {
    const line: Sock[] = [
      { id: 1, pattern: 0 },
      { id: 2, pattern: 1 },
      { id: 3, pattern: 1 },
      { id: 4, pattern: 0 },
      { id: 5, pattern: 2 },
      { id: 6, pattern: 2 },
    ]
    const next = unsettle(line, 3)
    expect(isIntakeMatch(next)).toBe(false)
    expect(intakeSolvable(next, 3)).toBe(true)
    expect(next[5]?.pattern).toBe(2)
    expect(patterns(line)).toEqual([0, 1, 1, 0, 2, 2])
  })
})

describe('stepLaundry', () => {
  it('folds the last two together, and drops them if the player never swaps', () => {
    const carefulRng = rngFrom(4)
    const carefulIds = { next: 1 }
    const opened = createLaundry(carefulRng, carefulIds)
    expect(isIntakeMatch(opened.line)).toBe(false)
    const prepared = prepareStep(opened)
    expect(isIntakeMatch(prepared.line)).toBe(true)
    const folded = stepLaundry(prepared, 3, 3, carefulRng, carefulIds)
    expect(folded.matched).toBe(true)
    expect(folded.left.pattern).toBe(folded.right.pattern)
    expect(folded.spawned[0]?.pattern).toBe(folded.spawned[1]?.pattern)
    expect(folded.state.line).toHaveLength(SLOT_COUNT)
    expect(isIntakeMatch(folded.state.line)).toBe(false)
    expect(inPlayEven(folded.state)).toBe(true)

    const idleRng = rngFrom(4)
    const idleIds = { next: 1 }
    const dropped = stepLaundry(createLaundry(idleRng, idleIds), 3, 3, idleRng, idleIds)
    expect(dropped.matched).toBe(false)
    expect(dropped.left.pattern).not.toBe(dropped.right.pattern)
    expect(inPlayEven(dropped.state)).toBe(true)
    expect(stepIsSavable(dropped.state, 3)).toBe(true)
    expect(isIntakeMatch(dropped.state.line)).toBe(false)
  })

  it('reties the orphans when a mismatch falls off', () => {
    const tied = retie(
      [
        { id: 1, pattern: 0 },
        { id: 2, pattern: 1 },
        { id: 3, pattern: 1 },
        { id: 4, pattern: 2 },
      ],
      { id: 7, pattern: 0 },
      { id: 6, pattern: 2 },
    )
    expect(countsAreEven(tied)).toBe(true)
    expect(tied.filter((sock) => sock.pattern === 0)).toHaveLength(2)
    expect(tied.filter((sock) => sock.pattern === 2)).toHaveLength(0)
  })
})

describe('pointsForCombo', () => {
  it('pays more for a longer streak', () => {
    expect(pointsForCombo(1)).toBe(100)
    expect(pointsForCombo(4)).toBe(400)
  })
})
