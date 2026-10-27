import { describe, expect, it } from 'vitest'
import {
  SLOT_COUNT,
  countsAreEven,
  createLaundry,
  createOpeningLine,
  difficulty,
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
    for (let beat = 0; beat < 48; beat++) {
      const diff = difficulty(folds)
      expect(state.line).toHaveLength(SLOT_COUNT)
      expect(inPlayEven(state)).toBe(true)
      expect(stepIsSavable(state, diff.window)).toBe(true)
      state = prepareStep(state)
      const outcome = stepLaundry(state, diff.window, diff.patterns, rng, ids)
      if (outcome.judged) {
        expect(outcome.matched).toBe(true)
        folds += 1
      } else {
        expect(outcome.state.held?.id).toBe(outcome.leaving.id)
      }
      state = outcome.state
    }
    expect(folds).toBeGreaterThan(15)
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
  it('does not hand over a fully sorted line', () => {
    let unsorted = 0
    for (let seed = 1; seed <= 24; seed++) {
      const rng = rngFrom(seed)
      const ids = { next: 1 }
      const line = createOpeningLine(rng, ids)
      expect(isIntakeMatch(line)).toBe(true)
      if (!isSortedPairs(line)) unsorted += 1
    }
    expect(unsorted).toBeGreaterThan(10)
  })
})

describe('stepLaundry', () => {
  it('parks the end sock, then folds its partner on the next step', () => {
    const rng = rngFrom(4)
    const ids = { next: 1 }
    const opened = createLaundry(rng, ids)
    const parked = stepLaundry(opened, 3, 3, rng, ids)
    expect(parked.judged).toBe(false)
    expect(parked.state.held?.pattern).toBe(parked.leaving.pattern)
    expect(parked.state.line[SLOT_COUNT - 1]?.pattern).toBe(parked.leaving.pattern)
    const folded = stepLaundry(parked.state, 3, 3, rng, ids)
    expect(folded.judged).toBe(true)
    expect(folded.matched).toBe(true)
    expect(folded.state.held).toBeNull()
    expect(inPlayEven(folded.state)).toBe(true)
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

function isSortedPairs(line: readonly Sock[]): boolean {
  for (let index = 0; index < line.length; index += 2) {
    if (line[index]?.pattern !== line[index + 1]?.pattern) return false
  }
  return true
}

describe('pointsForCombo', () => {
  it('pays more for a longer streak', () => {
    expect(pointsForCombo(1)).toBe(100)
    expect(pointsForCombo(4)).toBe(400)
  })
})
