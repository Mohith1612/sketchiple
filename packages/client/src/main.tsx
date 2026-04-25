import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { persistence } from './crdt/indexeddb.js'
import { getShapesMap } from './crdt/doc.js'
import { useShapeStore, initShapeStoreSync } from './store/shapeStore.js'
import { App } from './App.js'
import { ErrorBoundary } from './ErrorBoundary.js'

async function init() {
  // 1. Restore Y.Doc from IndexedDB before rendering
  await persistence.whenSynced

  // 2. Populate Zustand with the restored Yjs state
  const shapesMap = getShapesMap()
  const initialShapes = Object.fromEntries(shapesMap.entries())
  useShapeStore.getState()._setShapes(initialShapes)

  // 3. Wire the Yjs → Zustand observer bridge (remote updates)
  initShapeStoreSync()

  // 4. Mount React — canvas renders immediately with restored local state
  const rootEl = document.getElementById('root')
  if (!rootEl) throw new Error('Missing #root element')

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}

init().catch(console.error)
