export type ShapeType = 'rect' | 'ellipse'
export type ShapeId = string

export interface Shape {
  id: ShapeId
  type: ShapeType
  x: number
  y: number
  width: number
  height: number
  stroke: string
  fill: string
  strokeWidth: number
  opacity: number
}
