/** Socks hang in a row. Index 0 is farthest from the drawer; the last two are next in. */

export const SLOT_COUNT = 6
export const LIVES = 3
export const PATTERN_COUNT = 6

export type Sock = {
  id: number
  pattern: number
}

export type IdGen = { next: number }

/** Returns a number in [0, 1). */
export type Rng = () => number

export type Difficulty = {
  /** How many socks at the drawer end are guaranteed to contain a matching pair. */
  window: number
  intervalMs: number
  patterns: number
  /** Neighbor swaps applied before the intake window is repaired. */
  scramble: number
}

export function makeSock(pattern: number, ids: IdGen): Sock {
  return { id: ids.next++, pattern }
}

export function swapAt(line: readonly Sock[], index: number): Sock[] {
  if (index < 0 || index >= line.length - 1) return [...line]
  const next = [...line]
  const left = next[index]
  const right = next[index + 1]
  if (!left || !right) return next
  next[index] = right
  next[index + 1] = left
  return next
}

export function isIntakeMatch(line: readonly Sock[]): boolean {
  if (line.length < 2) return false
  const left = line[line.length - 2]
  const right = line[line.length - 1]
  return !!left && !!right && left.pattern === right.pattern
}

export function intakeSolvable(line: readonly Sock[], window: number): boolean {
  const count = line.length
  if (count < 2) return false
  const span = Math.max(2, Math.min(window, count))
  const pattern = line[count - 1]?.pattern
  const start = count - span
  for (let index = start; index < count - 1; index++) {
    if (line[index]?.pattern === pattern) return true
  }
  return false
}

export function partnerIndex(line: readonly Sock[], index: number): number {
  const pattern = line[index]?.pattern
  if (pattern == null) return -1
  let best = -1
  let bestDist = Infinity
  for (let cursor = 0; cursor < line.length; cursor++) {
    if (cursor === index || line[cursor]?.pattern !== pattern) continue
    const dist = Math.abs(cursor - index)
    if (dist < bestDist || (dist === bestDist && cursor > best)) {
      bestDist = dist
      best = cursor
    }
  }
  return best
}

/**
 * Slide the rightmost sock's partner toward the drawer until it sits inside `window`.
 * A line that already has a pair in that window is left as it is.
 */
export function repairIntake(line: readonly Sock[], window: number): Sock[] {
  const next = [...line]
  const count = next.length
  if (count < 2) return next
  const span = Math.max(2, Math.min(window, count))
  if (intakeSolvable(next, span)) return next

  const start = count - span
  const partner = partnerIndex(next, count - 1)
  if (partner < 0) {
    const edge = next[count - 1]
    const donor = next[count - 2]
    if (edge && donor) next[count - 2] = { ...donor, pattern: edge.pattern }
    return next
  }

  let index = partner
  while (index < start) {
    const left = next[index]
    const right = next[index + 1]
    if (!left || !right) break
    next[index] = right
    next[index + 1] = left
    index += 1
  }
  return next
}

function exchange(line: Sock[], i: number, j: number): void {
  const a = line[i]
  const b = line[j]
  if (!a || !b || i === j) return
  line[i] = b
  line[j] = a
}

function slide(line: Sock[], from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= line.length || to >= line.length) return
  const step = from < to ? 1 : -1
  let cursor = from
  while (cursor !== to) {
    exchange(line, cursor, cursor + step)
    cursor += step
  }
}

/**
 * Park the end sock's partner at the far edge of the window.
 * The last two are not a pair, so the line will not fold itself.
 */
export function unsettle(line: readonly Sock[], window: number): Sock[] {
  const count = line.length
  if (count < 3) return [...line]
  const span = Math.max(3, Math.min(window, count))
  const start = count - span
  const next = [...line]
  const end = count - 1
  const pattern = next[end]?.pattern
  if (pattern == null) return next

  let partner = partnerIndex(next, end)
  if (partner < 0) return next
  if (partner !== start) slide(next, partner, start)

  if (isIntakeMatch(next)) {
    for (let index = end - 2; index >= 0; index--) {
      if (next[index]?.pattern !== pattern) {
        exchange(next, index, end - 1)
        break
      }
    }
  }

  partner = partnerIndex(next, end)
  if (partner >= 0 && partner < start) slide(next, partner, start)
  if (isIntakeMatch(next) && next[start]?.pattern !== pattern && start < end - 1) {
    exchange(next, start, end - 1)
    partner = partnerIndex(next, end)
    if (partner >= 0 && partner < start) slide(next, partner, start)
  }
  return next
}

/** Sock the player still needs to walk toward the drawer. -1 when the last two already match. */
export function helperIndex(line: readonly Sock[]): number {
  const end = line.length - 1
  if (end < 1 || isIntakeMatch(line)) return -1
  return partnerIndex(line, end)
}

/** Move the nearest partner next to the rightmost sock. This is what a perfect fold looks like. */
export function bubblePartnerToIntake(line: readonly Sock[]): Sock[] {
  const next = [...line]
  const count = next.length
  if (count < 2 || isIntakeMatch(next)) return next
  let index = partnerIndex(next, count - 1)
  if (index < 0) return next
  while (index < count - 2) {
    const left = next[index]
    const right = next[index + 1]
    if (!left || !right) break
    next[index] = right
    next[index + 1] = left
    index += 1
  }
  return next
}

export function scramble(line: readonly Sock[], swaps: number, rng: Rng): Sock[] {
  const next = [...line]
  if (next.length < 2 || swaps <= 0) return next
  for (let step = 0; step < swaps; step++) {
    const index = Math.floor(rng() * (next.length - 1))
    const left = next[index]
    const right = next[index + 1]
    if (!left || !right) continue
    next[index] = right
    next[index + 1] = left
  }
  return next
}

export function countsAreEven(line: readonly Sock[]): boolean {
  const counts = new Map<number, number>()
  for (const sock of line) counts.set(sock.pattern, (counts.get(sock.pattern) ?? 0) + 1)
  for (const count of counts.values()) {
    if (count % 2 !== 0) return false
  }
  return true
}

export function difficulty(folds: number): Difficulty {
  const safeFolds = Math.max(0, folds)
  const patterns = safeFolds < 6 ? 3 : safeFolds < 14 ? 4 : safeFolds < 24 ? 5 : PATTERN_COUNT
  const window = Math.min(SLOT_COUNT, 3 + Math.floor(safeFolds / 6))
  const intervalMs = Math.max(1100, 2800 - safeFolds * 45)
  const scramble = safeFolds < 4 ? 4 : safeFolds < 12 ? 6 : 8
  return { window, intervalMs, patterns, scramble }
}

export function pointsForCombo(combo: number): number {
  return 100 * Math.max(1, combo)
}

export function createOpeningLine(rng: Rng, ids: IdGen): Sock[] {
  const line: Sock[] = []
  const pairs = SLOT_COUNT / 2
  for (let pattern = 0; pattern < pairs; pattern++) {
    line.push(makeSock(pattern, ids), makeSock(pattern, ids))
  }
  // The first pair is ready to fold. Everything behind it is jumbled.
  return bubblePartnerToIntake(scramble(line, 12, rng))
}

export type Laundry = {
  line: Sock[]
}

export type StepOutcome = {
  state: Laundry
  left: Sock
  right: Sock
  matched: boolean
  spawned: [Sock, Sock]
}

export function createLaundry(rng: Rng, ids: IdGen): Laundry {
  return { line: unsettle(createOpeningLine(rng, ids), 3) }
}

/** Every pattern on the line still has a partner somewhere. */
export function inPlayEven(state: Laundry): boolean {
  return countsAreEven(state.line)
}

/** The next fold can be made by neighbor swaps inside the window. */
export function stepIsSavable(state: Laundry, window: number): boolean {
  return intakeSolvable(state.line, window)
}

/** Put the last two into the pair a careful player would fold. */
export function prepareStep(state: Laundry): Laundry {
  return { ...state, line: bubblePartnerToIntake(state.line) }
}

/**
 * Give the two orphaned socks a shared pattern after a mismatched pair leaves.
 * The fallen socks are already off the line.
 */
export function retie(line: readonly Sock[], fallenA: Sock, fallenB: Sock): Sock[] {
  if (fallenA.pattern === fallenB.pattern) return [...line]
  const next = [...line]
  let donorIndex = -1
  for (let index = next.length - 1; index >= 0; index--) {
    if (next[index]?.pattern === fallenB.pattern) {
      donorIndex = index
      break
    }
  }
  const donor = next[donorIndex]
  if (!donor) return next
  next[donorIndex] = { ...donor, pattern: fallenA.pattern }
  return next
}

/**
 * One beat. The last two socks leave together.
 * A match is folded. A mismatch falls, and the line is retied so pairs stay even.
 * Two new socks hop on at the far end, then the intake is left one swap away.
 */
export function stepLaundry(
  state: Laundry,
  window: number,
  patterns: number,
  rng: Rng,
  ids: IdGen,
): StepOutcome {
  const count = state.line.length
  const left = state.line[count - 2]
  const right = state.line[count - 1]
  if (!left || !right) {
    throw new Error('The line needs two socks')
  }
  const matched = left.pattern === right.pattern
  let line = state.line.slice(0, -2)
  if (!matched) line = retie(line, left, right)
  const pattern = pickPattern(line, patterns, rng)
  const spawned: [Sock, Sock] = [makeSock(pattern, ids), makeSock(pattern, ids)]
  line = unsettle([spawned[0], spawned[1], ...line], window)
  return { state: { line }, left, right, matched, spawned }
}

function pickPattern(existing: readonly Sock[], patterns: number, rng: Rng): number {
  const available = Math.max(2, Math.min(PATTERN_COUNT, patterns))
  const counts = Array.from({ length: available }, () => 0)
  for (const sock of existing) {
    const pattern = sock.pattern
    if (pattern >= 0 && pattern < available) counts[pattern] = (counts[pattern] ?? 0) + 1
  }
  const least = Math.min(...counts)
  const pool = counts.flatMap((count, pattern) => (count === least ? [pattern] : []))
  return pool[Math.floor(rng() * pool.length)] ?? 0
}
