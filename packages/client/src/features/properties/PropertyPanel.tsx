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

  const allText = selected.every((s) => s.type === 'text')
  const fontSize = allText ? getSharedValue(selected, 'fontSize') : null
  const fontFamily = allText ? getSharedValue(selected, 'fontFamily') : null
  const fontWeight = allText ? getSharedValue(selected, 'fontWeight') : null
  const textAlign = allText ? getSharedValue(selected, 'textAlign') : null

  const strokeValue = stroke === 'mixed' ? '#000000' : stroke
  const fillValue = fill === 'mixed' || !fill || fill === 'transparent' ? '#ffffff' : fill
  const strokeWidthValue = strokeWidth === 'mixed' ? 2 : strokeWidth
  const strokeWidthLabel = strokeWidth === 'mixed' ? '–' : strokeWidth
  const opacityValue = opacity === 'mixed' ? 1 : opacity
  const opacityLabel = opacity === 'mixed' ? '–' : `${Math.round(opacity * 100)}%`
  const fontSizeValue = fontSize === 'mixed' || fontSize == null ? 16 : fontSize
  const fontSizeLabel = fontSize === 'mixed' ? '–' : fontSizeValue
  const fontFamilyValue =
    fontFamily === 'mixed' || !fontFamily ? 'system-ui, sans-serif' : fontFamily
  const fontWeightValue =
    fontWeight === 'mixed' || !fontWeight ? 'normal' : fontWeight
  const textAlignValue = textAlign === 'mixed' || !textAlign ? 'left' : textAlign

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
      {/* Font size — text shapes only */}
      {allText && (
        <>
          <div>
            <label style={label}>
              Font size:{' '}
              {fontSizeLabel}
            </label>
            <input
              type="number"
              min={8}
              max={200}
              style={{ ...inp, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 4 }}
              value={fontSizeValue}
              onChange={(e) => previewAll({ fontSize: Number(e.target.value) })}
              onBlur={(e) =>
                batchCommit({ fontSize: Number(e.target.value) })
              }
            />
          </div>

          <div>
            <label style={label}>Font family</label>
            <select
              style={{ ...inp, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4 }}
              value={fontFamilyValue}
              onChange={(e) => {
                previewAll({ fontFamily: e.target.value })
                batchCommit({ fontFamily: e.target.value })
              }}
            >
              <option value="system-ui, sans-serif">System</option>
              <option value="Inter, system-ui, sans-serif">Inter</option>
              <option value="Arial, Helvetica, sans-serif">Arial</option>
              <option value="Georgia, serif">Georgia</option>
              <option value="ui-monospace, SFMono-Regular, Menlo, monospace">Monospace</option>
            </select>
          </div>

          <div>
            <label style={label}>Font weight</label>
            <select
              style={{ ...inp, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 4 }}
              value={fontWeightValue}
              onChange={(e) => {
                const value: 'normal' | 'bold' = e.target.value === 'bold' ? 'bold' : 'normal'
                previewAll({ fontWeight: value })
                batchCommit({ fontWeight: value })
              }}
            >
              <option value="normal">Normal</option>
              <option value="bold">Bold</option>
            </select>
          </div>

          <div>
            <label style={label}>Text align</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                ['left', 'Left'],
                ['center', 'Center'],
                ['right', 'Right'],
              ] as const).map(([value, title]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    previewAll({ textAlign: value })
                    batchCommit({ textAlign: value })
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    background: textAlignValue === value ? '#6366f1' : '#f8fafc',
                    color: textAlignValue === value ? '#fff' : '#334155',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
