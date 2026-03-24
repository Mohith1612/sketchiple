export type ShapeType = 'rect' | 'ellipse' | 'arrow' | 'text' | 'freehand'
export type ShapeId = string

export interface Shape {
  id: ShapeId
  /** Optional logical group id used for grouped selection/actions */
  groupId?: string
  type: ShapeType
  x: number
  y: number
  width: number
  height: number
  stroke: string
  fill: string
  strokeWidth: number
  opacity: number
  /** Arrow only — [[startX, startY], [endX, endY]] (absolute, or frozen when unbound) */
  points?: [[number, number], [number, number]]
  /** Arrow binding — id of shape the start/end endpoint is bound to */
  fromShapeId?: string
  toShapeId?: string
  /** Relative anchor within bound shape bbox, values in [0..1] */
  fromAnchor?: { x: number; y: number }
  toAnchor?: { x: number; y: number }
  /** Text only */
  content?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: 'normal' | 'bold'
  textAlign?: 'left' | 'center' | 'right'
  /** Freehand only — RDP-simplified path as [x, y] pairs */
  freehandPoints?: [number, number][]
}
