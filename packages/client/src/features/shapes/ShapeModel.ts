import type { Shape, ShapeType } from '@canvas-draw/shared'
import { newId } from '../../lib/uuid.js'

export interface CreateShapeOptions {
  type: ShapeType
  x: number
  y: number
  width: number
  height: number
  stroke?: string
  fill?: string
  strokeWidth?: number
  opacity?: number
  /** Arrow: [[startX, startY], [endX, endY]] */
  points?: [[number, number], [number, number]]
  /** Freehand: RDP-simplified path */
  freehandPoints?: [number, number][]
}

export function createShape(opts: CreateShapeOptions): Shape {
  const shape: Shape = {
    id: newId(),
    type: opts.type,
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    stroke: opts.stroke ?? '#000000',
    fill: opts.fill ?? 'rgba(0,0,0,0)',
    strokeWidth: opts.strokeWidth ?? 2,
    opacity: opts.opacity ?? 1,
  }
  if (opts.points !== undefined) {
    shape.points = opts.points
  }
  if (opts.freehandPoints !== undefined) {
    shape.freehandPoints = opts.freehandPoints
  }
  return shape
}
