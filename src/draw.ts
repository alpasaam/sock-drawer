export type Layout = {
  w: number
  h: number
  lineLeft: number
  lineRight: number
  lineY: number
  sag: number
  slotX: number[]
  slotY: number[]
  step: number
  sockW: number
  sockH: number
  drawer: { x: number; y: number; w: number; h: number }
  mouth: { x: number; y: number; w: number; h: number }
  knob: { x: number; y: number }
}

export type SockDraw = {
  id: number
  pattern: number
  x: number
  y: number
  lift: number
  bounce: number
  glow: 'none' | 'next' | 'ready'
  scale: number
  alpha: number
}

export type GhostDraw = {
  pattern: number
  face: 1 | -1
  x: number
  y: number
  scale: number
  alpha: number
}

export type Frame = {
  layout: Layout
  time: number
  socks: SockDraw[]
  ghosts: GhostDraw[]
  /** 1 is a full beat, 0 is the step. */
  timer: number
  urgent: boolean
  ready: boolean
  actionLabel: string
  shortcut: string
  nextLabel: string
  shake: number
  open: number
  reduceMotion: boolean
}

type Palette = {
  body: string
  cuff: string
  toe: string
  heel: string
  ink: string
}

const PALETTES: readonly Palette[] = [
  { body: '#e25b4a', cuff: '#f7f1e6', toe: '#f7f1e6', heel: '#c4473a', ink: '#f8d2c6' },
  { body: '#1f4e79', cuff: '#f2e3b8', toe: '#f2e3b8', heel: '#16395a', ink: '#f2e3b8' },
  { body: '#2f8f6b', cuff: '#e7f3ec', toe: '#1d6b50', heel: '#1d6b50', ink: '#d7f0e4' },
  { body: '#e2b15a', cuff: '#6b3f2a', toe: '#6b3f2a', heel: '#6b3f2a', ink: '#6b3f2a' },
  { body: '#c9a6e0', cuff: '#f7f4ef', toe: '#8d6bb0', heel: '#8d6bb0', ink: '#f7f4ef' },
  { body: '#f4f1ea', cuff: '#147a78', toe: '#147a78', heel: '#147a78', ink: '#147a78' },
]

export function computeLayout(w: number, h: number): Layout {
  const drawerW = clamp(w * 0.18, 78, 150)
  const lineLeft = clamp(w * 0.055, 18, 56)
  const lineRight = w - drawerW - clamp(w * 0.035, 10, 36)
  const lineY = clamp(h * 0.38, 108, h * 0.46)
  const sag = clamp(h * 0.02, 6, 18)
  const span = Math.max(120, lineRight - lineLeft)
  const slotCount = 6
  const step = span / slotCount
  const sockH = clamp(Math.min(h * 0.34, step * 2.7), 92, 168)
  const sockW = clamp(sockH * 0.52, 34, step * 0.9)
  const slotX: number[] = []
  const slotY: number[] = []
  for (let index = 0; index < slotCount; index++) {
    const x = lineLeft + step * (index + 0.5)
    slotX.push(x)
    slotY.push(linePoint(lineLeft, lineRight, lineY, sag, x))
  }
  const drawerX = w - drawerW - clamp(w * 0.018, 6, 16)
  const drawerH = clamp(sockH * 1.45, 148, 230)
  const drawerY = lineY + sockH * 0.08
  const mouthH = clamp(sockH * 0.42, 40, 72)
  return {
    w,
    h,
    lineLeft,
    lineRight,
    lineY,
    sag,
    slotX,
    slotY,
    step,
    sockW,
    sockH,
    drawer: { x: drawerX, y: drawerY, w: drawerW, h: drawerH },
    mouth: { x: drawerX + 10, y: drawerY + 8, w: drawerW - 28, h: mouthH },
    knob: { x: drawerX + drawerW * 0.42, y: drawerY + mouthH + 36 },
  }
}

export function faceFor(id: number): 1 | -1 {
  return id % 2 === 0 ? 1 : -1
}

export function paint(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { layout, time } = frame
  ctx.save()
  if (frame.shake > 0.2) ctx.translate(Math.sin(time * 0.08) * frame.shake, 0)
  sky(ctx, layout, time)
  hills(ctx, layout)
  posts(ctx, layout)
  drawerBack(ctx, layout, frame.open)
  intakeWash(ctx, frame)
  for (const sock of frame.socks) drawSock(ctx, layout, sock, frame.reduceMotion ? 0 : time)
  for (const ghost of frame.ghosts) {
    drawSock(
      ctx,
      layout,
      {
        id: -1,
        pattern: ghost.pattern,
        x: ghost.x,
        y: ghost.y,
        lift: 0,
        bounce: 0,
        glow: 'none',
        scale: ghost.scale,
        alpha: ghost.alpha,
      },
      0,
      ghost.face,
    )
  }
  lineRope(ctx, layout)
  pins(ctx, frame)
  beatBead(ctx, frame)
  drawerFront(ctx, frame)
  ctx.restore()
}

function sky(ctx: CanvasRenderingContext2D, layout: Layout, time: number): void {
  const { w, h } = layout
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, '#8ecae6')
  gradient.addColorStop(0.45, '#d7eef8')
  gradient.addColorStop(0.72, '#f6e7cf')
  gradient.addColorStop(1, '#e7d3ae')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#ffe7a3'
  ctx.beginPath()
  ctx.arc(w * 0.78, h * 0.16, clamp(w * 0.06, 28, 58), 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  blob(ctx, (time * 0.012) % (w + 160) - 80, h * 0.14, 54, 18)
  blob(ctx, ((time * 0.008) % (w + 220) - 40) * 0.8 + w * 0.15, h * 0.22, 36, 12)
}

function hills(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { w, h } = layout
  ctx.fillStyle = '#8fb56a'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.78)
  ctx.quadraticCurveTo(w * 0.25, h * 0.7, w * 0.55, h * 0.8)
  ctx.quadraticCurveTo(w * 0.78, h * 0.86, w, h * 0.74)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()

  ctx.fillStyle = '#7aa45c'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.86)
  ctx.quadraticCurveTo(w * 0.4, h * 0.8, w, h * 0.9)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.fill()
}

function posts(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { lineLeft, lineY, h } = layout
  wood(ctx, lineLeft - 7, lineY - 36, 14, h * 0.78 - (lineY - 36))
  ctx.fillStyle = '#6d442c'
  ctx.fillRect(lineLeft - 16, h * 0.78, 32, 8)
}

function lineRope(ctx: CanvasRenderingContext2D, layout: Layout): void {
  ctx.strokeStyle = '#f7f3ea'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  const steps = 24
  for (let index = 0; index <= steps; index++) {
    const t = index / steps
    const x = layout.lineLeft + (layout.lineRight - layout.lineLeft) * t
    const y = linePoint(layout.lineLeft, layout.lineRight, layout.lineY, layout.sag, x)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.strokeStyle = 'rgba(120, 80, 40, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function beatBead(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { layout } = frame
  const t = 1 - Math.min(1, Math.max(0, frame.timer))
  const x = layout.lineLeft + (layout.lineRight - layout.lineLeft) * t
  const y = linePoint(layout.lineLeft, layout.lineRight, layout.lineY, layout.sag, x)
  ctx.fillStyle = frame.urgent ? '#e25b4a' : '#e0b56a'
  ctx.beginPath()
  ctx.arc(x, y, 6.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#8a5a32'
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function intakeWash(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { layout } = frame
  const right = layout.slotX[5]
  const left = layout.slotX[4]
  if (left == null || right == null) return
  const x = (left + right) / 2
  const y = layout.slotY[5] ?? layout.lineY
  const radius = layout.step * 1.15
  const color = frame.ready ? 'rgba(80, 150, 90, 0.22)' : 'rgba(226, 91, 74, 0.1)'
  const wash = ctx.createRadialGradient(x, y + layout.sockH * 0.35, 8, x, y + layout.sockH * 0.35, radius)
  wash.addColorStop(0, color)
  wash.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = wash
  ctx.beginPath()
  ctx.arc(x, y + layout.sockH * 0.35, radius, 0, Math.PI * 2)
  ctx.fill()

  if (!frame.nextLabel) return
  ctx.fillStyle = frame.ready ? '#2f6b45' : '#8a4b32'
  ctx.font = '600 13px Outfit, "Avenir Next", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(frame.nextLabel, x, y - 28)
}

function pins(ctx: CanvasRenderingContext2D, frame: Frame): void {
  for (const sock of frame.socks) {
    if (sock.scale < 0.9) continue
    const y = sock.y - sock.lift * 10
    drawPin(ctx, sock.x, y)
  }
}

function drawerBack(ctx: CanvasRenderingContext2D, layout: Layout, open: number): void {
  const { drawer, mouth } = layout
  ctx.fillStyle = '#a86b3d'
  roundRect(ctx, drawer.x, drawer.y, drawer.w, drawer.h, 16)
  ctx.fill()
  ctx.fillStyle = '#3a2418'
  roundRect(ctx, mouth.x, mouth.y, mouth.w, mouth.h + open * 10, 10)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(mouth.x + 8, mouth.y + 8, mouth.w - 16, 8)
}

function drawerFront(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { layout } = frame
  const { drawer, mouth, knob } = layout
  const frontY = mouth.y + mouth.h + 8 + (1 - frame.open) * 14
  const frontH = drawer.y + drawer.h - frontY - 10
  ctx.fillStyle = '#c9854a'
  roundRect(ctx, drawer.x + 8, frontY, drawer.w - 16, Math.max(36, frontH), 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(90, 50, 20, 0.25)'
  ctx.lineWidth = 2
  roundRect(ctx, drawer.x + 8, frontY, drawer.w - 16, Math.max(36, frontH), 12)
  ctx.stroke()

  const ring = Math.min(frame.timer, 1)
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(80, 40, 20, 0.18)'
  ctx.lineWidth = 5
  ctx.arc(knob.x, knob.y, 16, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = frame.urgent ? '#e25b4a' : frame.ready ? '#2f8f6b' : '#f7f1e6'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.arc(knob.x, knob.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring)
  ctx.stroke()
  ctx.fillStyle = frame.ready ? '#f3e6c2' : '#f7f1e6'
  ctx.beginPath()
  ctx.arc(knob.x, knob.y, 8, 0, Math.PI * 2)
  ctx.fill()

  if (frame.actionLabel) {
    ctx.fillStyle = '#2f6b45'
    ctx.font = '600 14px Outfit, "Avenir Next", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(frame.actionLabel, knob.x, knob.y + 36)
  }
  if (frame.shortcut) {
    ctx.fillStyle = '#6a4a32'
    ctx.font = '600 12px Outfit, "Avenir Next", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(frame.shortcut, knob.x, knob.y + 54)
  }
}

function drawSock(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  sock: SockDraw,
  time: number,
  faceOverride?: 1 | -1,
): void {
  const palette = PALETTES[sock.pattern % PALETTES.length] ?? PALETTES[0]
  if (!palette) return
  const face = faceOverride ?? faceFor(sock.id)
  const sway = time === 0 ? 0 : Math.sin(time * 0.002 + sock.id) * 0.045
  const hop = Math.sin(Math.min(1, sock.bounce) * Math.PI) * 16
  const w = layout.sockW * sock.scale
  const h = layout.sockH * sock.scale
  const cuffH = h * 0.13
  const legW = w * 0.48

  ctx.save()
  ctx.globalAlpha = sock.alpha
  ctx.translate(sock.x, sock.y - sock.lift * 12 - hop)
  ctx.rotate(sway * face)

  if (sock.glow === 'ready' || sock.glow === 'next') {
    ctx.fillStyle = sock.glow === 'ready' ? 'rgba(47, 143, 107, 0.2)' : 'rgba(226, 91, 74, 0.1)'
    ctx.beginPath()
    ctx.ellipse(face * w * 0.12, h * 0.62, w * 0.62, h * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(80, 50, 30, 0.14)'
  ctx.beginPath()
  ctx.ellipse(face * w * 0.12, h * 0.98, w * 0.46, h * 0.045, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.scale(face, 1)
  ctx.fillStyle = palette.body
  sockOutline(ctx, w, h)
  ctx.fill()
  ctx.save()
  sockOutline(ctx, w, h)
  ctx.clip()
  motif(ctx, sock.pattern, legW, h, palette)
  ctx.fillStyle = palette.toe
  ctx.beginPath()
  ctx.ellipse(w * 0.5, h * 0.7, w * 0.16, h * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = palette.heel
  ctx.beginPath()
  ctx.ellipse(-w * 0.08, h * 0.74, w * 0.12, h * 0.09, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.strokeStyle = 'rgba(50, 30, 20, 0.22)'
  ctx.lineWidth = 1.5
  sockOutline(ctx, w, h)
  ctx.stroke()

  ctx.fillStyle = palette.cuff
  roundRect(ctx, -legW / 2 - 1, 0, legW + 2, cuffH, 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(70, 40, 20, 0.22)'
  ctx.lineWidth = 1
  for (let rib = 1; rib <= 3; rib++) {
    const y = (cuffH * rib) / 4
    ctx.beginPath()
    ctx.moveTo(-legW / 2, y)
    ctx.lineTo(legW / 2, y)
    ctx.stroke()
  }
  ctx.restore()
}

function sockOutline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const leg = w * 0.5
  const ankle = h * 0.62
  const footH = h * 0.16
  const toe = w * 0.34
  ctx.beginPath()
  ctx.moveTo(-leg / 2, 0)
  ctx.lineTo(-leg / 2, ankle)
  ctx.quadraticCurveTo(-leg * 0.72, ankle + footH * 0.35, -leg * 0.15, ankle + footH)
  ctx.lineTo(toe, ankle + footH * 0.9)
  ctx.quadraticCurveTo(toe + w * 0.14, ankle + footH * 0.45, toe, ankle - footH * 0.05)
  ctx.quadraticCurveTo(leg * 0.7, ankle - footH * 0.55, leg / 2, ankle - h * 0.04)
  ctx.lineTo(leg / 2, 0)
  ctx.closePath()
}

function motif(
  ctx: CanvasRenderingContext2D,
  pattern: number,
  legW: number,
  h: number,
  palette: Palette,
): void {
  ctx.fillStyle = palette.ink
  ctx.strokeStyle = palette.ink
  ctx.lineWidth = 2
  if (pattern % 6 === 0) {
    for (let stripe = 0; stripe < 5; stripe++) {
      ctx.fillRect(-legW, h * 0.18 + stripe * h * 0.1, legW * 2, h * 0.035)
    }
    return
  }
  if (pattern % 6 === 1) {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.beginPath()
        ctx.arc(-legW * 0.18 + col * legW * 0.36, h * 0.22 + row * h * 0.12, legW * 0.08, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    return
  }
  if (pattern % 6 === 2) {
    for (let rib = 0; rib < 4; rib++) {
      ctx.fillRect(-legW * 0.32 + rib * legW * 0.22, h * 0.16, 2, h * 0.5)
    }
    return
  }
  if (pattern % 6 === 3) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        diamond(ctx, -legW * 0.16 + col * legW * 0.34, h * 0.24 + row * h * 0.14, legW * 0.12, h * 0.05)
      }
    }
    return
  }
  if (pattern % 6 === 4) {
    ctx.fillRect(-legW, h * 0.42, legW * 2, h * 0.08)
    return
  }
  const cell = legW * 0.22
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if ((row + col) % 2 === 0) continue
      ctx.fillRect(-legW * 0.4 + col * cell, h * 0.18 + row * cell * 0.8, cell, cell * 0.8)
    }
  }
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = '#e0b56a'
  ctx.strokeStyle = '#8a5a32'
  ctx.lineWidth = 1
  roundRect(ctx, -5, -11, 10, 14, 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, -4)
  ctx.lineTo(0, 2)
  ctx.stroke()
  ctx.restore()
}

function linePoint(left: number, right: number, lineY: number, sag: number, x: number): number {
  const mid = (left + right) / 2
  const half = Math.max(1, (right - left) / 2)
  const t = (x - mid) / half
  return lineY + sag * (1 - t * t)
}

function wood(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#8d5b3c'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + w * 0.35, y + 8)
  ctx.lineTo(x + w * 0.35, y + h - 8)
  ctx.stroke()
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.ellipse(x + rx * 0.7, y + 4, rx * 0.7, ry * 0.8, 0, 0, Math.PI * 2)
  ctx.fill()
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y - ry)
  ctx.lineTo(x + rx, y)
  ctx.lineTo(x, y + ry)
  ctx.lineTo(x - rx, y)
  ctx.closePath()
  ctx.fill()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
