import { useEffect, useRef, useState } from 'react'
import { CanvasEngine } from './canvas/CanvasEngine.js'
import { renderScene, startCursorLoop } from './canvas/CanvasRenderer.js'
import { createDrawingHandlers } from './features/drawing/index.js'
import type { DraftShape } from './features/drawing/index.js'
import { createSelectionHandlers } from './features/selection/index.js'
import { useSelectionStore } from './features/selection/selectionStore.js'
import { useUiStore, type Tool } from './store/uiStore.js'
import { initAwareness, ConnectionStatus, FollowPanel } from './features/collaboration/index.js'
import { wsProvider } from './crdt/sync.js'
import { newId } from './lib/uuid.js'
import { exportToJSON, exportToPNG, exportToSVG } from './features/export/index.js'
import { DebugPanel } from './features/debug/index.js'
import {
  removeShape,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  groupSelected,
  ungroupSelected,
  alignSelected,
} from './features/shapes/index.js'
import { undoManager } from './crdt/undoManager.js'
import { createTextHandlers, TextOverlay } from './features/text/index.js'
import type { TextEditingState } from './features/text/index.js'
import { PropertyPanel } from './features/properties/index.js'
import { copySelected, pasteClipboard, duplicate } from './features/clipboard/index.js'
import { Minimap } from './features/minimap/index.js'
import { useShapeStore } from './store/shapeStore.js'
import { ydoc, getShapesMap } from './crdt/doc.js'
import type { Shape } from '@canvas-draw/shared'

function getRoomId(): string {
  const hash = window.location.hash.slice(1)
  if (hash) return hash
  const id = newId()
  window.location.hash = id
  return id
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: '↖ Select' },
  { id: 'rect', label: '▭ Rect' },
  { id: 'ellipse', label: '◯ Ellipse' },
  { id: 'arrow', label: '→ Arrow' },
  { id: 'text', label: 'T Text' },
  { id: 'freehand', label: '✏ Pen' },
  { id: 'pan', label: '✋ Pan' },
]

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<CanvasEngine | null>(null)
  const [draft, setDraft] = useState<DraftShape | null>(null)
  const draftRef = useRef<DraftShape | null>(null)
  const prevToolRef = useRef<Tool | null>(null)
  const [textEditing, setTextEditing] = useState<TextEditingState | null>(null)

  const activeTool = useUiStore((s) => s.activeTool)
  const setTool = useUiStore((s) => s.setTool)
  const selectedCount = useSelectionStore((s) => s.selectedIds.size)
  const isFollowing = useUiStore((s) => s.followingUserId !== null)

  // Undo/redo stack lengths for button disabled state
  const [undoLen, setUndoLen] = useState(undoManager.undoStack.length)
  const [redoLen, setRedoLen] = useState(undoManager.redoStack.length)

  // Copy-link feedback
  const [copied, setCopied] = useState(false)

  draftRef.current = draft

  // Bootstrap canvas engine
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new CanvasEngine(canvas)
    engineRef.current = engine

    engine.setRenderCallback((ctx) => {
      renderScene(ctx, draftRef.current)
    })

    const cleanupDrawing = createDrawingHandlers(
      canvas,
      (d) => setDraft(d),
      () => engine.requestRender(),
    )

    const cleanupSelection = createSelectionHandlers(canvas, () => {
      engine.requestRender()
    })

    const cleanupText = createTextHandlers(canvas, (state) => {
      setTextEditing(state)
    })

    const cleanupAwareness = initAwareness(canvas, engine)
    const stopCursorLoop = startCursorLoop(() => engine.requestRender())

    const roomId = getRoomId()
    wsProvider.connect(roomId)

    return () => {
      stopCursorLoop()
      cleanupDrawing()
      cleanupSelection()
      cleanupText()
      cleanupAwareness()
      engine.destroy()
    }
  }, [])

  // Re-render whenever anything in stores changes
  useEffect(() => {
    engineRef.current?.requestRender()
  })

  // Wheel zoom / pan
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const store = useUiStore.getState()
      // Local navigation breaks follow mode
      store.setFollowing(null)
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas!.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        const factor = e.deltaY < 0 ? 1.1 : 0.9
        const newZoom = Math.max(0.1, Math.min(10, store.viewport.zoom * factor))
        const scale = newZoom / store.viewport.zoom
        store.setViewport({
          zoom: newZoom,
          offsetX: mx - scale * (mx - store.viewport.offsetX),
          offsetY: my - scale * (my - store.viewport.offsetY),
        })
      } else {
        store.setViewport({
          offsetX: store.viewport.offsetX - e.deltaX,
          offsetY: store.viewport.offsetY - e.deltaY,
        })
      }
      engineRef.current?.requestRender()
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // Cursor style based on active tool
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (activeTool === 'pan') {
      canvas.style.cursor = 'grab'
    } else if (activeTool === 'select') {
      canvas.style.cursor = 'default'
    } else {
      canvas.style.cursor = 'crosshair'
    }
  }, [activeTool])

  // Space-key temporary pan
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat && useUiStore.getState().activeTool !== 'pan') {
        prevToolRef.current = useUiStore.getState().activeTool
        setTool('pan')
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' && prevToolRef.current) {
        setTool(prevToolRef.current)
        prevToolRef.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [setTool])

  // Undo / Redo / Delete / Nudge keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey

      // Don't fire shortcuts when a textarea is focused
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return

      if (meta && e.key === 'c') { e.preventDefault(); copySelected(); return }
      if (meta && e.key === 'v') { e.preventDefault(); pasteClipboard(); return }
      if (meta && e.key === 'd') { e.preventDefault(); duplicate(); return }

      if (meta && e.key.toLowerCase() === 'g' && !e.shiftKey) {
        e.preventDefault()
        groupSelected([...useSelectionStore.getState().selectedIds])
        return
      }
      if (meta && e.key.toLowerCase() === 'g' && e.shiftKey) {
        e.preventDefault()
        ungroupSelected([...useSelectionStore.getState().selectedIds])
        return
      }

      if (meta && e.shiftKey && ['l', 'e', 'r', 't', 'm', 'b'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        const ids = [...useSelectionStore.getState().selectedIds]
        const key = e.key.toLowerCase()
        if (key === 'l') alignSelected(ids, 'left')
        if (key === 'e') alignSelected(ids, 'hcenter')
        if (key === 'r') alignSelected(ids, 'right')
        if (key === 't') alignSelected(ids, 'top')
        if (key === 'm') alignSelected(ids, 'vcenter')
        if (key === 'b') alignSelected(ids, 'bottom')
        return
      }

      // Arrow key nudging — 1px normal, 10px with Shift
      const NUDGE_DELTAS: Record<string, [number, number]> = {
        ArrowLeft:  [-1, 0],
        ArrowRight: [1,  0],
        ArrowUp:    [0, -1],
        ArrowDown:  [0,  1],
      }
      if (e.code in NUDGE_DELTAS && !meta) {
        const { selectedIds } = useSelectionStore.getState()
        if (selectedIds.size > 0) {
          e.preventDefault()
          const factor = e.shiftKey ? 10 : 1
          const [baseDx, baseDy] = NUDGE_DELTAS[e.code]!
          const dx = baseDx * factor
          const dy = baseDy * factor
          const { shapes } = useShapeStore.getState()
          ydoc.transact(() => {
            for (const id of selectedIds) {
              const s = shapes[id]
              if (!s) continue
              const patch: Partial<Shape> = { x: s.x + dx, y: s.y + dy }
              if (s.points) {
                patch.points = [
                  [s.points[0][0] + dx, s.points[0][1] + dy],
                  [s.points[1][0] + dx, s.points[1][1] + dy],
                ]
              }
              if (s.freehandPoints) {
                patch.freehandPoints = s.freehandPoints.map(([px, py]) => [px + dx, py + dy])
              }
              const updated = { ...s, ...patch }
              getShapesMap().set(id, updated)
              useShapeStore.getState()._upsertShape(updated)
            }
          })
          return
        }
      }

      if (meta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoManager.undo()
        return
      }
      if ((meta && e.shiftKey && e.key === 'z') || (meta && e.key === 'y')) {
        e.preventDefault()
        undoManager.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't fire while a text textarea is active
        if ((e.target as HTMLElement).tagName === 'TEXTAREA') return
        const { selectedIds } = useSelectionStore.getState()
        if (selectedIds.size === 0) return
        // Don't intercept Backspace when typing in any input
        if (e.key === 'Backspace' && (e.target as HTMLElement).tagName !== 'BODY') return
        e.preventDefault()
        selectedIds.forEach((id) => removeShape(id))
        useSelectionStore.getState().deselectAll()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Sync undo/redo stack lengths for button disabled state
  useEffect(() => {
    const update = () => {
      setUndoLen(undoManager.undoStack.length)
      setRedoLen(undoManager.redoStack.length)
    }
    undoManager.on('stack-item-added', update)
    undoManager.on('stack-item-popped', update)
    undoManager.on('stack-item-updated', update)
    return () => {
      undoManager.off('stack-item-added', update)
      undoManager.off('stack-item-popped', update)
      undoManager.off('stack-item-updated', update)
    }
  }, [])

  function copyRoomLink() {
    navigator.clipboard.writeText(window.location.href).catch(console.error)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnBase: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    background: '#f1f5f9',
    color: '#334155',
  }
  const btnDisabled: React.CSSProperties = {
    ...btnBase,
    opacity: 0.4,
    cursor: 'default',
  }
  const divider = <div style={{ width: 1, background: '#e2e8f0', margin: '0 4px' }} />

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Toolbar — shifts down when follow banner is visible */}
      <div
        style={{
          position: 'absolute',
          top: isFollowing ? 44 : 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 4,
          background: '#ffffff',
          borderRadius: 8,
          padding: '6px 10px',
          maxWidth: 'calc(100vw - 24px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          zIndex: 10,
        }}
      >
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            style={{
              ...btnBase,
              fontWeight: activeTool === t.id ? 700 : 400,
              background: activeTool === t.id ? '#6366f1' : '#f1f5f9',
              color: activeTool === t.id ? '#fff' : '#334155',
              transition: 'all 0.1s',
            }}
          >
            {t.label}
          </button>
        ))}

        {divider}

        <button
          onClick={() => undoManager.undo()}
          disabled={undoLen === 0}
          style={undoLen === 0 ? btnDisabled : btnBase}
          title="Undo (Ctrl+Z)"
        >
          ⟲ Undo
        </button>
        <button
          onClick={() => undoManager.redo()}
          disabled={redoLen === 0}
          style={redoLen === 0 ? btnDisabled : btnBase}
          title="Redo (Ctrl+Shift+Z)"
        >
          ⟳ Redo
        </button>

        {divider}

        <button
          onClick={() => sendToBack([...useSelectionStore.getState().selectedIds])}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Send to back"
        >
          ⇤ Back
        </button>
        <button
          onClick={() => sendBackward([...useSelectionStore.getState().selectedIds])}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Send backward"
        >
          ↙ Backward
        </button>
        <button
          onClick={() => bringForward([...useSelectionStore.getState().selectedIds])}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Bring forward"
        >
          ↗ Forward
        </button>
        <button
          onClick={() => bringToFront([...useSelectionStore.getState().selectedIds])}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Bring to front"
        >
          ⇥ Front
        </button>

        {divider}

        <button
          onClick={() => groupSelected([...useSelectionStore.getState().selectedIds])}
          disabled={selectedCount < 2}
          style={selectedCount < 2 ? btnDisabled : btnBase}
          title="Group"
        >
          ⊞ Group
        </button>
        <button
          onClick={() => ungroupSelected([...useSelectionStore.getState().selectedIds])}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Ungroup"
        >
          ⊟ Ungroup
        </button>

        {divider}

        <button
          onClick={() => alignSelected([...useSelectionStore.getState().selectedIds], 'left')}
          disabled={selectedCount < 2}
          style={selectedCount < 2 ? btnDisabled : btnBase}
          title="Align left"
        >
          ⇤ Align L
        </button>
        <button
          onClick={() => alignSelected([...useSelectionStore.getState().selectedIds], 'hcenter')}
          disabled={selectedCount < 2}
          style={selectedCount < 2 ? btnDisabled : btnBase}
          title="Align horizontal center"
        >
          ↔ Align C
        </button>
        <button
          onClick={() => alignSelected([...useSelectionStore.getState().selectedIds], 'right')}
          disabled={selectedCount < 2}
          style={selectedCount < 2 ? btnDisabled : btnBase}
          title="Align right"
        >
          ⇥ Align R
        </button>
        <button
          onClick={() => alignSelected([...useSelectionStore.getState().selectedIds], 'top')}
          disabled={selectedCount < 2}
          style={selectedCount < 2 ? btnDisabled : btnBase}
          title="Align top"
        >
          ⇡ Align T
        </button>
        <button
          onClick={() => alignSelected([...useSelectionStore.getState().selectedIds], 'vcenter')}
          disabled={selectedCount < 2}
          style={selectedCount < 2 ? btnDisabled : btnBase}
          title="Align vertical center"
        >
          ↕ Align M
        </button>
        <button
          onClick={() => alignSelected([...useSelectionStore.getState().selectedIds], 'bottom')}
          disabled={selectedCount < 2}
          style={selectedCount < 2 ? btnDisabled : btnBase}
          title="Align bottom"
        >
          ⇣ Align B
        </button>

        {divider}

        <button onClick={() => exportToJSON()} style={btnBase}>↓ JSON</button>
        <button
          onClick={() => exportToJSON({ selectedOnly: true })}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Export selected to JSON"
        >
          ↓ JSON Sel
        </button>
        <button onClick={() => { exportToPNG().catch(console.error) }} style={btnBase}>↓ PNG</button>
        <button
          onClick={() => { exportToPNG({ selectedOnly: true }).catch(console.error) }}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Export selected to PNG"
        >
          ↓ PNG Sel
        </button>
        <button onClick={() => exportToSVG()} style={btnBase}>↓ SVG</button>
        <button
          onClick={() => exportToSVG({ selectedOnly: true })}
          disabled={selectedCount === 0}
          style={selectedCount === 0 ? btnDisabled : btnBase}
          title="Export selected to SVG"
        >
          ↓ SVG Sel
        </button>

        {divider}

        <button onClick={copyRoomLink} style={copied ? { ...btnBase, color: '#16a34a' } : btnBase}>
          {copied ? '✓ Copied!' : '⎘ Share'}
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Shape property panel */}
      <PropertyPanel />

      {/* Text editing overlay */}
      {textEditing && (
        <TextOverlay editing={textEditing} onDone={() => setTextEditing(null)} />
      )}

      {/* Minimap */}
      <Minimap />

      {/* Connection status indicator */}
      <ConnectionStatus />

      {/* Follow panel + banner */}
      <FollowPanel />

      {/* Dev debug panel */}
      {import.meta.env.DEV && <DebugPanel />}
    </div>
  )
}
