export class LaundryAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted: boolean

  constructor() {
    this.muted = readMute()
  }

  toggle(): boolean {
    this.muted = !this.muted
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    } catch {
      /* private mode */
    }
    return this.muted
  }

  unlock(): void {
    const ctx = this.ensure()
    if (ctx.state !== 'running') void ctx.resume()
  }

  tick(): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    this.tone(ctx.currentTime, 520, 0.05, 'triangle', 0.035)
  }

  swap(): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const now = ctx.currentTime
    this.tone(now, 640, 0.035, 'triangle', 0.04)
    this.tone(now + 0.02, 880, 0.04, 'sine', 0.03)
  }

  fold(): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const now = ctx.currentTime
    this.tone(now, 523.25, 0.09, 'sine', 0.06)
    this.tone(now + 0.07, 659.25, 0.12, 'sine', 0.05)
  }

  nudge(): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    this.tone(ctx.currentTime, 196, 0.07, 'triangle', 0.035)
  }

  reject(): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const now = ctx.currentTime
    this.tone(now, 146, 0.14, 'triangle', 0.06)
    this.tone(now + 0.06, 110, 0.16, 'sine', 0.04)
  }

  over(): void {
    const ctx = this.ctx
    if (!ctx || this.muted) return
    const now = ctx.currentTime
    this.tone(now, 392, 0.12, 'sine', 0.05)
    this.tone(now + 0.12, 262, 0.22, 'sine', 0.05)
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = new AudioContext()
    const master = ctx.createGain()
    master.gain.value = 0.9
    master.connect(ctx.destination)
    this.ctx = ctx
    this.master = master
    return ctx
  }

  private tone(
    when: number,
    freq: number,
    duration: number,
    type: OscillatorType,
    amount: number,
  ): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || this.muted) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, when)
    gain.gain.setValueAtTime(0.0001, when)
    gain.gain.exponentialRampToValueAtTime(amount, when + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration)
    osc.connect(gain)
    gain.connect(master)
    osc.start(when)
    osc.stop(when + duration + 0.02)
  }
}

const MUTE_KEY = 'sock-drawer-mute'

function readMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}
