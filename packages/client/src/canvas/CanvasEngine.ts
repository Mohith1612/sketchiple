/**
 * Manages the HTMLCanvasElement lifecycle:
 * - Device pixel ratio scaling (sharp on HiDPI displays)
 * - ResizeObserver for responsive layout
 * - requestAnimationFrame loop with FPS/frame-time tracking
 */

export class CanvasEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private resizeObserver: ResizeObserver
  private renderCallback: ((ctx: CanvasRenderingContext2D) => void) | null = null

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
  }

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

  destroy(): void {
    this.resizeObserver.disconnect()
  }
}
