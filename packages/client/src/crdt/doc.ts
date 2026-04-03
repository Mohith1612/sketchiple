import * as Y from 'yjs'
import type { Shape } from '@canvas-draw/shared'

/** Singleton Y.Doc for this session. */
export const ydoc = new Y.Doc()

/**
 * Typed accessor for the shared shapes map.
 * Values are plain Shape objects (full replace semantics for V1).
 */
export function getShapesMap(): Y.Map<Shape> {
  return ydoc.getMap<Shape>('shapes')
}
