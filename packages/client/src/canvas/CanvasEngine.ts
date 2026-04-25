/**
 * Manages the HTMLCanvasElement lifecycle:
 * - Device pixel ratio scaling (sharp on HiDPI displays)
 * - ResizeObserver for responsive layout
 * - requestAnimationFrame loop with FPS/frame-time tracking
 */

/** Module-level perf metrics updated each render frame. Poll from DebugPanel. */
export const perfState = { fps: 0, frameTimeMs: 0 }

export class CanvasEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rafId: number | null = null
  private resizeObserver: ResizeObserver
  private renderCallback: ((ctx: CanvasRenderingContext2D) => void) | null = null
  private _dirty = true

  // Rolling 60-frame circular buffer for FPS / frame-time tracking
  private _frameBuf = new Float32Array(60)
  private _frameBufIdx = 0
  private _frameBufFull = false
  private _lastFrameTs = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2d context')
    this.ctx = ctx

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)
    this.resize()
  }

  private resize(): void {
    const dpr = window.devicePixelRatio ?? 1
    const parent = this.canvas.parentElement
    const w = parent?.clientWidth ?? window.innerWidth
    const h = parent?.clientHeight ?? window.innerHeight

    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.width = `${w}px`
    this.canvas.style.height = `${h}px`

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.requestRender()
  }

  /** Returns logical (CSS pixel) dimensions. */
  get logicalWidth(): number {
    return this.canvas.clientWidth
  }

  get logicalHeight(): number {
    return this.canvas.clientHeight
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  setRenderCallback(fn: (ctx: CanvasRenderingContext2D) => void): void {
    this.renderCallback = fn
  }

  /** Mark content as changed without scheduling a render immediately. */
  markDirty(): void {
    this._dirty = true
  }

  requestRender(): void {
    this._dirty = true
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame((ts) => {
      this.rafId = null
      if (!this._dirty) return
      this._dirty = false
      this._trackFrame(ts)
      if (this.renderCallback) {
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight)
        this.renderCallback(this.ctx)
      }
    })
  }

  private _trackFrame(ts: number): void {
    if (this._lastFrameTs > 0) {
      const delta = ts - this._lastFrameTs
      this._frameBuf[this._frameBufIdx] = delta
      this._frameBufIdx = (this._frameBufIdx + 1) % 60
      if (!this._frameBufFull && this._frameBufIdx === 0) this._frameBufFull = true

      const count = this._frameBufFull ? 60 : this._frameBufIdx
      if (count > 0) {
        let sum = 0
        for (let i = 0; i < count; i++) sum += this._frameBuf[i]!
        const avg = sum / count
        perfState.frameTimeMs = Math.round(avg * 10) / 10
        perfState.fps = avg > 0 ? Math.round(1000 / avg) : 0
      }
    }
    this._lastFrameTs = ts
  }

  getFps(): number {
    return perfState.fps
  }

  getFrameTimeMs(): number {
    return perfState.frameTimeMs
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.resizeObserver.disconnect()
  }
}
