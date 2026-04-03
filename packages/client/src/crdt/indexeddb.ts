import { IndexeddbPersistence } from 'y-indexeddb'
import { ydoc } from './doc.js'

/**
 * IndexedDB persistence for the Y.Doc.
 * Await `persistence.whenSynced` before rendering to restore local state.
 */
export const persistence = new IndexeddbPersistence('canvas-draw-v1', ydoc)
