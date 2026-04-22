import { useMemo } from 'react'
import type { Shape } from '@canvas-draw/shared'
import { useShapeStore } from '../../store/shapeStore.js'
import { useSelectionStore } from '../selection/selectionStore.js'
import { ydoc, getShapesMap } from '../../crdt/doc.js'

function getSharedValue<K extends keyof Shape>(
  shapes: Shape[],
  key: K,
): Shape[K] | 'mixed' {
  const vals = [...new Set(shapes.map((s) => s[key]))]
  return vals.length === 1 ? (vals[0] as Shape[K]) : 'mixed'
}

export function PropertyPanel() {
  const selectedIds = useSelectionStore((s) => s.selectedIds)
  const shapes = useShapeStore((s) => s.shapes)

  const selected = useMemo(
    () => [...selectedIds].map((id) => shapes[id]).filter(Boolean) as Shape[],
    [selectedIds, shapes],
  )

  if (selected.length === 0) return null

  const stroke = getSharedValue(selected, 'stroke')
  const fill = getSharedValue(selected, 'fill')
  const strokeWidth = getSharedValue(selected, 'strokeWidth')
  const opacity = getSharedValue(selected, 'opacity')

  const strokeValue = stroke === 'mixed' ? '#000000' : stroke
  const fillValue = fill === 'mixed' || !fill || fill === 'transparent' ? '#ffffff' : fill
  const strokeWidthValue = strokeWidth === 'mixed' ? 2 : strokeWidth
  const strokeWidthLabel = strokeWidth === 'mixed' ? '–' : strokeWidth
  const opacityValue = opacity === 'mixed' ? 1 : opacity
  const opacityLabel = opacity === 'mixed' ? '–' : `${Math.round(opacity * 100)}%`

  function previewAll(patch: Partial<Shape>): void {
    selected.forEach((s) => useShapeStore.getState()._upsertShape({ ...s, ...patch }))
  }

  function batchCommit(patch: Partial<Shape>): void {
    ydoc.transact(() => {
      selectedIds.forEach((id) => {
        const s = shapes[id]
        if (s) getShapesMap().set(id, { ...s, ...patch })
      })
    })
    // Zustand preview already applied by previewAll — no second upsert needed
  }

  const label: React.CSSProperties = {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 3,
    display: 'block',
    fontFamily: 'system-ui, sans-serif',
  }
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box' }

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 216,
        background: '#fff',
        borderLeft: '1px solid #e2e8f0',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        zIndex: 10,
        overflowY: 'auto',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, color: '#334155' }}>
        Properties{selected.length > 1 ? ` (${selected.length})` : ''}
      </div>

      {/* Stroke color */}
      <div>
        <label style={label}>Stroke color</label>
        <input
          type="color"
          style={inp}
          value={strokeValue}
          onChange={(e) => previewAll({ stroke: e.target.value })}
          onBlur={(e) => batchCommit({ stroke: e.target.value })}
        />
      </div>

      {/* Fill color */}
      <div>
        <label style={label}>Fill color</label>
        <input
          type="color"
          style={inp}
          value={fillValue}
          onChange={(e) => previewAll({ fill: e.target.value })}
          onBlur={(e) => batchCommit({ fill: e.target.value })}
        />
      </div>

      {/* Stroke width */}
      <div>
        <label style={label}>
          Stroke width:{' '}
          {strokeWidthLabel}
        </label>
        <input
          type="range"
          min={1}
          max={20}
          style={inp}
          value={strokeWidthValue}
          onChange={(e) => previewAll({ strokeWidth: Number(e.target.value) })}
          onPointerUp={(e) =>
            batchCommit({
              strokeWidth: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>

      {/* Opacity */}
      <div>
        <label style={label}>
          Opacity:{' '}
          {opacityLabel}
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          style={inp}
          value={opacityValue}
          onChange={(e) => previewAll({ opacity: Number(e.target.value) })}
          onPointerUp={(e) =>
            batchCommit({
              opacity: Number((e.target as HTMLInputElement).value),
            })
          }
        />
      </div>
    </div>
  )
}
