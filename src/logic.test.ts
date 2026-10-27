import { describe, expect, it } from 'vitest'
import {
  SLOT_COUNT,
  afterFold,
  bubblePartnerToIntake,
  countsAreEven,
  createOpeningLine,
  difficulty,
  intakeSolvable,
  isIntakeMatch,
  pointsForCombo,
  repairIntake,
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
  it('stays even and solvable, and a perfect player can always fold', () => {
    const rng = rngFrom(11)
    const ids = { next: 1 }
    let line = createOpeningLine(rng, ids)
    for (let folds = 0; folds < 48; folds++) {
      const diff = difficulty(folds)
      expect(countsAreEven(line)).toBe(true)
      expect(intakeSolvable(line, diff.window)).toBe(true)
      line = bubblePartnerToIntake(line)
      expect(isIntakeMatch(line)).toBe(true)
      line = afterFold(line, diff.patterns, diff.window, rng, ids)
      expect(line).toHaveLength(SLOT_COUNT)
    }
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
    expect(later.intervalMs).toBeGreaterThanOrEqual(1600)
  })
})

describe('pointsForCombo', () => {
  it('pays more for a longer streak', () => {
    expect(pointsForCombo(1)).toBe(100)
    expect(pointsForCombo(4)).toBe(400)
  })
})
