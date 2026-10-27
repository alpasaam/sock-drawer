import { LaundryAudio } from './audio.ts'
import {
  computeLayout,
  faceFor,
  paint,
  type Frame,
  type GhostDraw,
  type Layout,
  type SockDraw,
} from './draw.ts'
import {
  LIVES,
  createLaundry,
  difficulty,
  isIntakeMatch,
  pointsForCombo,
  stepLaundry,
  swapAt,
  type IdGen,
  type Sock,
} from './logic.ts'

const BEST_KEY = 'sock-drawer-best'

type Phase = 'title' | 'play' | 'pause' | 'over'

type Actor = {
  sock: Sock
  slot: number
  x: number
  y: number
  bounce: number
}

type Ghost = {
  pattern: number
  face: 1 | -1
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
}

type Drag = {
  pointerId: number
  sockId: number
  originX: number
  moved: boolean
}

type Floater = {
  text: string
  x: number
  y: number
  life: number
  max: number
}

export class Game {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly audio = new LaundryAudio()
  private readonly reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  private readonly ids: IdGen = { next: 1 }

  private phase: Phase = 'title'
  private line: Sock[] = []
  private actors: Actor[] = []
  private ghosts: Ghost[] = []
  private layout: Layout = computeLayout(800, 600)
  private drag: Drag | null = null
  private selectedId: number | null = null
  private score = 0
  private best = readBest()
  private bestAtStart = readBest()
  private combo = 0
  private bestCombo = 0
  private folds = 0
  private lives = LIVES
  private timeLeft = difficulty(0).intervalMs
  private lock = 0
  private shake = 0
  private open = 0.6
  private pendingOver = false
  private floaters: Floater[] = []
  private last = 0
  private snapped = false

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is unavailable')
    this.canvas = canvas
    this.ctx = ctx
    const laundry = createLaundry(Math.random, this.ids)
    this.line = laundry.line
    this.bindUi()
    this.bindPointer()
    this.syncHud()
    this.showCard('title')
  }

  startLoop(): void {
    const frame = (now: number) => {
      const dt = this.last === 0 ? 16 : Math.min(48, now - this.last)
      this.last = now
      this.step(dt, now)
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  private bindUi(): void {
    byId('start').addEventListener('click', () => this.startRun(false))
    byId('again').addEventListener('click', () => this.startRun(true))
    byId('resume').addEventListener('click', () => this.setPhase('play'))
    byId('pause').addEventListener('click', () => this.togglePause())
    byId('mute').addEventListener('click', () => this.toggleMute())
    this.paintMute()
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return
      if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
        if (this.phase === 'play' || this.phase === 'pause') {
          event.preventDefault()
          this.togglePause()
        }
      } else if (event.key === 'Enter' && this.phase === 'title') {
        this.startRun(false)
      } else if (event.key === ' ' && this.phase === 'play') {
        event.preventDefault()
        this.stepNow(false)
      }
    })
    window.addEventListener('resize', () => this.resize())
  }

  private bindPointer(): void {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    this.canvas.addEventListener('pointerdown', (event) => this.onDown(event))
    this.canvas.addEventListener('pointermove', (event) => this.onMove(event))
    this.canvas.addEventListener('pointerup', (event) => this.onUp(event))
    this.canvas.addEventListener('pointercancel', (event) => this.onUp(event))
  }

  private startRun(fresh: boolean): void {
    this.audio.unlock()
    if (fresh || this.phase === 'over') {
      this.ids.next = 1
      const laundry = createLaundry(Math.random, this.ids)
      this.line = laundry.line
      this.actors = []
      this.ghosts = []
      this.snapped = false
      this.score = 0
      this.combo = 0
      this.bestCombo = 0
      this.folds = 0
      this.lives = LIVES
      this.pendingOver = false
      this.selectedId = null
      this.drag = null
    }
    this.bestAtStart = this.best
    this.timeLeft = difficulty(this.folds).intervalMs
    this.lock = 0
    this.setPhase('play')
  }

  private togglePause(): void {
    if (this.phase === 'play') this.setPhase('pause')
    else if (this.phase === 'pause') this.setPhase('play')
  }

  private toggleMute(): void {
    this.audio.toggle()
    this.paintMute()
  }

  private setPhase(phase: Phase): void {
    this.phase = phase
    if (phase === 'play') this.audio.unlock()
    if (phase !== 'play') byId('hint').hidden = true
    this.showCard(phase)
    this.syncHud()
  }

  private step(dt: number, now: number): void {
    this.resize()
    if (this.phase === 'play' && this.lock <= 0) {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) this.stepNow(true)
    }
    if (this.lock > 0) {
      this.lock -= dt
      if (this.lock <= 0 && this.pendingOver) this.finish()
    }
    this.shake *= Math.exp(-dt / 90)
    for (const floater of this.floaters) {
      floater.life -= dt
      floater.y -= dt * 0.02
    }
    this.floaters = this.floaters.filter((floater) => floater.life > 0)
    const targetOpen = this.ghosts.length > 0 ? 1 : this.phase === 'play' ? 0.72 : 0.58
    this.open += (targetOpen - this.open) * (1 - Math.exp(-dt / 140))
    this.placeActors(dt)
    this.stepGhosts(dt)
    for (const actor of this.actors) actor.bounce = Math.max(0, actor.bounce - dt / 420)
    this.paint(now)
  }

  private stepNow(forced: boolean): void {
    if (this.phase !== 'play' || this.lock > 0) return
    const right = this.line[this.line.length - 1]
    const left = this.line[this.line.length - 2]
    if (!left || !right) return
    if (!forced && left.pattern !== right.pattern) {
      this.shake = 3
      this.audio.nudge()
      this.note('Not yet')
      return
    }

    const leftActor = this.actors.find((actor) => actor.sock.id === left.id) ?? null
    const rightActor = this.actors.find((actor) => actor.sock.id === right.id) ?? null
    const diff = difficulty(this.folds)
    const outcome = stepLaundry({ line: this.line }, diff.window, diff.patterns, Math.random, this.ids)
    this.line = outcome.state.line
    this.selectedId = null
    this.drag = null
    this.lock = this.reduceMotion ? 180 : 460

    if (outcome.matched) {
      this.combo += 1
      this.folds += 1
      this.bestCombo = Math.max(this.bestCombo, this.combo)
      const gained = pointsForCombo(this.combo)
      this.score += gained
      if (this.score > this.best) {
        this.best = this.score
        writeBest(this.best)
      }
      this.note(`+${gained}`)
      this.audio.fold()
      this.releaseSock(leftActor, true)
      this.releaseSock(rightActor, true)
    } else {
      this.combo = 0
      this.lives -= 1
      this.audio.reject()
      this.shake = 8
      this.note('Not a pair')
      this.releaseSock(leftActor, false)
      this.releaseSock(rightActor, false)
      if (this.lives <= 0) this.pendingOver = true
    }

    this.timeLeft = difficulty(this.folds).intervalMs
    this.ensureActors(false)
    this.syncHud()
  }

  private releaseSock(actor: Actor | null, intoDrawer: boolean): void {
    if (!actor) return
    const mouthX = this.layout.mouth.x + this.layout.mouth.w * 0.45
    this.ghosts.push({
      pattern: actor.sock.pattern,
      face: faceFor(actor.sock.id),
      x: actor.x,
      y: actor.y,
      vx: intoDrawer ? (mouthX - actor.x) / 280 : 0.04,
      vy: intoDrawer ? 0.16 : 0.42,
      life: 460,
      max: 460,
    })
  }

  private finish(): void {
    this.pendingOver = false
    this.audio.over()
    this.setPhase('over')
    const summary = byId('over-summary')
    const pairs = this.folds === 1 ? '1 pair' : `${this.folds} pairs`
    summary.textContent = `You folded ${pairs}.`
    text('over-score', String(this.score))
    text('over-pairs', String(this.folds))
    text('over-combo', String(this.bestCombo))
    text('over-best', String(this.best))
    const banner = byId('new-best')
    const isNew = this.score > this.bestAtStart && this.folds > 0
    banner.hidden = !isNew
  }

  private onDown(event: PointerEvent): void {
    if (this.phase !== 'play' || this.lock > 0 || this.drag) return
    this.audio.unlock()
    const point = this.eventPoint(event)
    const actor = this.hitSock(point.x, point.y)
    if (!actor) {
      if (this.hitDrawer(point.x, point.y)) this.stepNow(false)
      else this.selectedId = null
      return
    }
    this.drag = {
      pointerId: event.pointerId,
      sockId: actor.sock.id,
      originX: point.x,
      moved: false,
    }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private onMove(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return
    const point = this.eventPoint(event)
    if (Math.abs(point.x - this.drag.originX) > 8) this.drag.moved = true
    const actor = this.actors.find((item) => item.sock.id === this.drag?.sockId)
    if (!actor) return
    const left = this.layout.slotX[0] ?? point.x
    const right = this.layout.slotX[this.layout.slotX.length - 1] ?? point.x
    actor.x = clamp(point.x, left, right)
    for (let guard = 0; guard < 4; guard++) {
      const index = actor.slot
      const slotX = this.layout.slotX
      const here = slotX[index]
      const prev = slotX[index - 1]
      const next = slotX[index + 1]
      if (here == null) break
      if (next != null && point.x > (here + next) / 2 + 6) {
        this.swapSlots(index)
        continue
      }
      if (prev != null && point.x < (prev + here) / 2 - 6) {
        this.swapSlots(index - 1)
        continue
      }
      break
    }
  }

  private onUp(event: PointerEvent): void {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return
    const drag = this.drag
    this.drag = null
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    if (drag.moved || this.phase !== 'play') return
    const actor = this.actors.find((item) => item.sock.id === drag.sockId)
    if (actor) this.onTap(actor)
  }

  private onTap(actor: Actor): void {
    if (this.selectedId == null) {
      this.selectedId = actor.sock.id
      return
    }
    if (this.selectedId === actor.sock.id) {
      this.selectedId = null
      return
    }
    const selected = this.actors.find((item) => item.sock.id === this.selectedId)
    if (selected && Math.abs(selected.slot - actor.slot) === 1) {
      this.swapSlots(Math.min(selected.slot, actor.slot))
      this.selectedId = null
      return
    }
    this.selectedId = actor.sock.id
  }

  private swapSlots(index: number): void {
    if (index < 0 || index >= this.line.length - 1) return
    this.line = swapAt(this.line, index)
    this.reindex()
    this.audio.swap()
  }

  private reindex(): void {
    this.line.forEach((sock, slot) => {
      const actor = this.actors.find((item) => item.sock.id === sock.id)
      if (actor) {
        actor.slot = slot
        actor.sock = sock
      }
    })
  }

  private ensureActors(snap: boolean): void {
    const byId = new Map(this.actors.map((actor) => [actor.sock.id, actor]))
    const next: Actor[] = []
    this.line.forEach((sock, slot) => {
      const existing = byId.get(sock.id)
      const x = this.layout.slotX[slot] ?? 0
      const y = this.layout.slotY[slot] ?? this.layout.lineY
      if (existing) {
        existing.sock = sock
        existing.slot = slot
        if (snap) {
          existing.x = x
          existing.y = y
        }
        next.push(existing)
        return
      }
      next.push({
        sock,
        slot,
        x: snap ? x : (this.layout.slotX[0] ?? x) - this.layout.sockW,
        y,
        bounce: 0,
      })
    })
    this.actors = next
  }

  private placeActors(dt: number): void {
    if (!this.snapped && this.layout.slotX.length === this.line.length) {
      this.ensureActors(true)
      this.snapped = true
    } else if (this.actors.length !== this.line.length) {
      this.ensureActors(false)
    }
    const blend = 1 - Math.exp(-dt / (this.reduceMotion ? 40 : 90))
    for (const actor of this.actors) {
      const targetX = this.layout.slotX[actor.slot] ?? actor.x
      const targetY = this.layout.slotY[actor.slot] ?? actor.y
      const dragging = this.drag?.sockId === actor.sock.id
      if (!dragging) actor.x += (targetX - actor.x) * blend
      actor.y += (targetY - actor.y) * blend
    }
  }

  private stepGhosts(dt: number): void {
    for (const ghost of this.ghosts) {
      ghost.life -= dt
      ghost.x += ghost.vx * dt
      ghost.y += ghost.vy * dt
      ghost.vy += 0.0011 * dt
    }
    this.ghosts = this.ghosts.filter((ghost) => ghost.life > 0)
  }

  private paint(now: number): void {
    const partnerReady = this.partnerReady()
    const interval = difficulty(this.folds).intervalMs
    const timer = clamp(this.timeLeft / interval, 0, 1)
    const socks: SockDraw[] = this.actors.map((actor) => ({
      id: actor.sock.id,
      pattern: actor.sock.pattern,
      x: actor.x,
      y: actor.y,
      lift: this.selectedId === actor.sock.id || this.drag?.sockId === actor.sock.id ? 1 : 0,
      bounce: actor.bounce,
      glow: glowFor(this.line, actor.slot, partnerReady),
      scale: 1,
      alpha: 1,
    }))
    const ghosts: GhostDraw[] = this.ghosts.map((ghost) => ({
      pattern: ghost.pattern,
      face: ghost.face,
      x: ghost.x,
      y: ghost.y,
      scale: 0.55 + 0.45 * (ghost.life / ghost.max),
      alpha: Math.max(0, ghost.life / ghost.max),
    }))
    const frame: Frame = {
      layout: this.layout,
      time: now,
      socks,
      ghosts,
      timer: this.phase === 'title' ? 1 : timer,
      urgent: this.phase === 'play' && timer < 0.28 && !partnerReady,
      ready: this.phase === 'play' && partnerReady,
      actionLabel: this.phase === 'play' && partnerReady ? 'Fold' : '',
      shortcut: this.phase === 'play' && partnerReady ? 'Space' : '',
      nextLabel: this.phase === 'play' && this.folds < 3 ? (partnerReady ? 'Ready' : 'Swap') : '',
      shake: this.shake,
      open: this.open,
      reduceMotion: this.reduceMotion,
    }
    this.ctx.clearRect(0, 0, this.layout.w, this.layout.h)
    paint(this.ctx, frame)
    this.paintFloaters()
    this.paintHint(partnerReady)
  }

  private partnerReady(): boolean {
    return isIntakeMatch(this.line)
  }

  private note(text: string): void {
    this.floaters.push({
      text,
      x: this.layout.knob.x,
      y: this.layout.knob.y - 28,
      life: 900,
      max: 900,
    })
  }

  private paintFloaters(): void {
    const ctx = this.ctx
    ctx.save()
    ctx.font = '600 18px Outfit, "Avenir Next", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#3a2a22'
    for (const floater of this.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life / floater.max)
      ctx.fillText(floater.text, floater.x, floater.y)
    }
    ctx.restore()
  }

  private paintHint(partnerReady: boolean): void {
    const hint = byId('hint')
    if (this.phase !== 'play' || this.folds >= 3) {
      hint.hidden = true
      return
    }
    hint.hidden = false
    if (partnerReady) {
      hint.textContent = 'Those two match. Press Space, or tap the drawer, to fold them.'
      return
    }
    hint.textContent = 'Swap until the last two socks match. Space folds a pair.'
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelW = Math.round(width * dpr)
    const pixelH = Math.round(height * dpr)
    if (this.canvas.width !== pixelW || this.canvas.height !== pixelH) {
      this.canvas.width = pixelW
      this.canvas.height = pixelH
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.layout = computeLayout(width, height)
  }

  private hitSock(x: number, y: number): Actor | null {
    let best: Actor | null = null
    let bestDist = Infinity
    for (const actor of this.actors) {
      const center = this.layout.slotX[actor.slot]
      const top = this.layout.slotY[actor.slot]
      if (center == null || top == null) continue
      const half = this.layout.step * 0.5
      if (Math.abs(x - center) > half) continue
      if (y < top - 28 || y > top + this.layout.sockH + 12) continue
      const dist = Math.abs(x - center)
      if (dist < bestDist) {
        bestDist = dist
        best = actor
      }
    }
    return best
  }

  private hitDrawer(x: number, y: number): boolean {
    const { drawer } = this.layout
    return x >= drawer.x && x <= drawer.x + drawer.w && y >= drawer.y - 12 && y <= drawer.y + drawer.h
  }

  private eventPoint(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  private syncHud(): void {
    text('pairs', String(this.folds))
    text('score', String(this.score))
    text('best', String(this.best))
    text('title-best', String(this.best))
    const lives = byId('lives')
    lives.replaceChildren()
    for (let index = 0; index < LIVES; index++) {
      const pip = document.createElement('span')
      pip.className = index < this.lives ? 'pip on' : 'pip'
      lives.appendChild(pip)
    }
    lives.setAttribute('aria-label', `${this.lives} of ${LIVES} lives left`)
    const hud = byId('hud')
    hud.hidden = this.phase === 'title'
  }

  private showCard(phase: Phase): void {
    const veil = byId('veil')
    veil.hidden = phase === 'play'
    byId('title-card').hidden = phase !== 'title'
    byId('pause-card').hidden = phase !== 'pause'
    byId('over-card').hidden = phase !== 'over'
    if (phase === 'title') text('title-best', String(this.best))
  }

  private paintMute(): void {
    const button = byId('mute')
    button.textContent = this.audio.muted ? 'Sound off' : 'Sound'
    button.setAttribute('aria-pressed', String(this.audio.muted))
  }
}

function glowFor(line: readonly Sock[], slot: number, partnerReady: boolean): SockDraw['glow'] {
  const end = line.length - 1
  if (slot === end || (partnerReady && slot === end - 1)) return partnerReady ? 'ready' : 'next'
  return 'none'
}

function byId(id: string): HTMLElement {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing #${id}`)
  return node
}

function text(id: string, value: string): void {
  byId(id).textContent = value
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

function writeBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* private mode */
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
