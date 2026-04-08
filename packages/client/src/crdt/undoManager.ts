import * as Y from 'yjs'
import { getShapesMap } from './doc.js'

/**
 * Tracks local (null-origin) transactions only.
 * `captureTimeout: 500` groups rapid changes (e.g. drag) into a single undo step.
 * Remote updates from collaborators use a non-null origin and are excluded automatically.
 */
export const undoManager = new Y.UndoManager(getShapesMap(), {
  captureTimeout: 500,
  trackedOrigins: new Set([null]),
})
