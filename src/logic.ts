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
  /** The sock that stepped into the drawer and is waiting for its partner. */
  held: Sock | null
  /** Pattern of a sock promised on the next step, so pairs stay even. */
  pending: number | null
}

export type StepOutcome = {
  state: Laundry
  leaving: Sock
  spawned: Sock
  /** True when a sock was already waiting and this step completes the pair. */
  judged: boolean
  matched: boolean
}

export function createLaundry(rng: Rng, ids: IdGen): Laundry {
  return { line: createOpeningLine(rng, ids), held: null, pending: null }
}

/** Counts on the line, in the drawer mouth, and promised for the next step. */
export function inPlayEven(state: Laundry): boolean {
  const counts = new Map<number, number>()
  const add = (pattern: number) => counts.set(pattern, (counts.get(pattern) ?? 0) + 1)
  for (const sock of state.line) add(sock.pattern)
  if (state.held) add(state.held.pattern)
  if (state.pending != null) add(state.pending)
  for (const count of counts.values()) {
    if (count % 2 !== 0) return false
  }
  return true
}

/** The next step can be made into a match by neighbor swaps inside the window. */
export function stepIsSavable(state: Laundry, window: number): boolean {
  if (!state.held) return intakeSolvable(state.line, window)
  const count = state.line.length
  const span = Math.max(1, Math.min(window, count))
  const start = count - span
  return state.line.slice(start).some((sock) => sock.pattern === state.held?.pattern)
}

/** Slide the nearest sock of `pattern` onto the last peg. */
export function bubblePatternToEnd(line: readonly Sock[], pattern: number): Sock[] {
  const next = [...line]
  let index = -1
  for (let cursor = next.length - 1; cursor >= 0; cursor--) {
    if (next[cursor]?.pattern === pattern) {
      index = cursor
      break
    }
  }
  if (index < 0) return next
  while (index < next.length - 1) {
    const left = next[index]
    const right = next[index + 1]
    if (!left || !right) break
    next[index] = right
    next[index + 1] = left
    index += 1
  }
  return next
}

/** Put the line into the arrangement a careful player would step from. */
export function prepareStep(state: Laundry): Laundry {
  if (state.held) return { ...state, line: bubblePatternToEnd(state.line, state.held.pattern) }
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
 * One beat. The last sock steps off, a new sock hops on the far end.
 * The first step only parks the sock in the drawer. The second step folds a match or drops a mismatch.
 */
export function stepLaundry(
  state: Laundry,
  window: number,
  patterns: number,
  rng: Rng,
  ids: IdGen,
): StepOutcome {
  const count = state.line.length
  const leaving = state.line[count - 1]
  if (!leaving) {
    throw new Error('The line is empty')
  }
  const rest = state.line.slice(0, -1)
  const spawned = takeSpawn(rest, state.pending, patterns, rng, ids)
  let line = [spawned.sock, ...rest]

  if (!state.held) {
    return {
      state: { line, held: leaving, pending: spawned.pending },
      leaving,
      spawned: spawned.sock,
      judged: false,
      matched: false,
    }
  }

  const matched = state.held.pattern === leaving.pattern
  if (!matched) line = retie(line, state.held, leaving)
  line = repairIntake(line, window)
  return {
    state: { line, held: null, pending: spawned.pending },
    leaving,
    spawned: spawned.sock,
    judged: true,
    matched,
  }
}

function takeSpawn(
  existing: readonly Sock[],
  pending: number | null,
  patterns: number,
  rng: Rng,
  ids: IdGen,
): { sock: Sock; pending: number | null } {
  if (pending != null) return { sock: makeSock(pending, ids), pending: null }
  const pattern = pickPattern(existing, patterns, rng)
  return { sock: makeSock(pattern, ids), pending: pattern }
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
