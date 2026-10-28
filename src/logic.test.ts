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
  it('slides survivors toward the drawer and keeps pairs even', () => {
    const rng = rngFrom(11)
    const ids = { next: 1 }
    let state = createLaundry(rng, ids)
    let folds = 0
    let differentArrivals = 0
    for (let beat = 0; beat < 36; beat++) {
      const diff = difficulty(folds)
      expect(state.line).toHaveLength(SLOT_COUNT)
      expect(state.incoming[0]?.pattern).not.toBe(state.incoming[1]?.pattern)
      expect(inPlayEven(state)).toBe(true)
      if (!isIntakeMatch(state.line) && helperIndex(state.line) >= 0) state = prepareStep(state)
      const survivors = state.line.slice(0, -2).map((sock) => sock.id)
      const ready = isIntakeMatch(state.line)
      const outcome = stepLaundry(state, diff.patterns, rng, ids)
      expect(outcome.matched).toBe(ready)
      expect(outcome.state.line.slice(2).map((sock) => sock.id)).toEqual(survivors)
      if (outcome.matched) folds += 1
      if (outcome.spawned[0]?.pattern !== outcome.spawned[1]?.pattern) differentArrivals += 1
      state = outcome.state
    }
    expect(folds).toBeGreaterThan(8)
    expect(differentArrivals).toBeGreaterThan(24)
  })
})

describe('difficulty', () => {
  it('starts generous and asks for more as pairs stack up', () => {
    const early = difficulty(0)
    const later = difficulty(24)
    expect(early.patterns).toBe(3)
    expect(early.window).toBe(3)
    expect(early.intervalMs).toBe(2800)
    expect(early.intervalMs).toBeGreaterThan(later.intervalMs)
    expect(later.patterns).toBe(6)
    expect(later.window).toBe(SLOT_COUNT)
    expect(later.scramble).toBeGreaterThan(early.scramble)
    const at = (folds: number) => difficulty(folds).intervalMs
    expect(at(40)).toBeGreaterThan(1400)
    expect(at(80)).toBeLessThan(at(40))
    expect(at(160)).toBeLessThan(at(80))
    expect(at(160)).toBeGreaterThan(600)
    expect(at(0) - at(20)).toBeGreaterThan(at(60) - at(80))
  })
})

describe('deals that need a swap', () => {
  it('does not hand the same drag back every beat', () => {
    const rng = rngFrom(8)
    const ids = { next: 1 }
    let state = createLaundry(rng, ids)
    let misses = 0
    const partnerSlots: number[] = []
    for (let beat = 0; beat < 16; beat++) {
      const end = state.line[state.line.length - 1]
      partnerSlots.push(state.line.findIndex((sock, index) => index < state.line.length - 1 && sock.pattern === end?.pattern))
      let line = swapAt(state.line, 0)
      line = swapAt(line, 1)
      state = { ...state, line }
      const outcome = stepLaundry(state, difficulty(0).patterns, rng, ids)
      if (!outcome.matched) misses += 1
      state = outcome.state
    }
    expect(misses).toBeGreaterThan(4)
    expect(new Set(partnerSlots).size).toBeGreaterThan(1)
  })

  it('keeps survivor order when a pair is folded', () => {
    const rng = rngFrom(9)
    const ids = { next: 1 }
    const opened = prepareStep(createLaundry(rng, ids))
    const survivors = opened.line.slice(0, -2).map((sock) => sock.id)
    const folded = stepLaundry(opened, 3, rng, ids)
    expect(folded.matched).toBe(true)
    expect(folded.state.line.slice(2).map((sock) => sock.id)).toEqual(survivors)
    expect(folded.spawned[0]?.pattern).not.toBe(folded.spawned[1]?.pattern)
    expect(inPlayEven(folded.state)).toBe(true)
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
    const folded = stepLaundry(prepared, 3, carefulRng, carefulIds)
    expect(folded.matched).toBe(true)
    expect(folded.left.pattern).toBe(folded.right.pattern)
    expect(folded.spawned[0]?.pattern).not.toBe(folded.spawned[1]?.pattern)
    expect(folded.state.line).toHaveLength(SLOT_COUNT)
    expect(inPlayEven(folded.state)).toBe(true)

    const idleRng = rngFrom(4)
    const idleIds = { next: 1 }
    const idle = createLaundry(idleRng, idleIds)
    const dropped = stepLaundry(idle, 3, idleRng, idleIds)
    expect(dropped.matched).toBe(isIntakeMatch(idle.line))
    expect(inPlayEven(dropped.state)).toBe(true)
    expect(dropped.state.line.slice(2, 6).length).toBe(4)
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
