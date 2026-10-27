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
  const intervalMs = Math.max(1600, 5200 - safeFolds * 80)
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

export function spawnPair(
  existing: readonly Sock[],
  patterns: number,
  rng: Rng,
  ids: IdGen,
): [Sock, Sock] {
  const used = new Set(existing.map((sock) => sock.pattern))
  const available = Math.max(2, Math.min(PATTERN_COUNT, patterns))
  const free: number[] = []
  const all: number[] = []
  for (let pattern = 0; pattern < available; pattern++) {
    all.push(pattern)
    if (!used.has(pattern)) free.push(pattern)
  }
  const pool = free.length > 0 ? free : all
  const pattern = pool[Math.floor(rng() * pool.length)] ?? 0
  return [makeSock(pattern, ids), makeSock(pattern, ids)]
}

/** Remove the folded pair and deal two new socks onto the far end, then keep the next fold solvable. */
export function afterFold(
  line: readonly Sock[],
  patterns: number,
  window: number,
  scrambleSwaps: number,
  rng: Rng,
  ids: IdGen,
): Sock[] {
  const rest = line.slice(0, -2)
  const [left, right] = spawnPair(rest, patterns, rng, ids)
  const mixed = scramble([left, right, ...rest], scrambleSwaps, rng)
  return repairIntake(mixed, window)
}
