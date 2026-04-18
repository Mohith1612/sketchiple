import { useEffect, useRef } from 'react'
import { useShapeStore } from '../../store/shapeStore.js'
import { useUiStore } from '../../store/uiStore.js'
import { commitText, cancelText } from './TextHandler.js'
import type { TextEditingState } from './TextHandler.js'

interface Props {
  editing: TextEditingState
  onDone: () => void
}

export function TextOverlay({ editing, onDone }: Props) {
  const shape = useShapeStore((s) => s.shapes[editing.shapeId])
  const viewport = useUiStore((s) => s.viewport)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
    // Place cursor at end of existing content
    const el = ref.current
    if (el) {
      el.selectionStart = el.value.length
      el.selectionEnd = el.value.length
    }
  }, [])

  // Close overlay if shape was deleted remotely while editing
  useEffect(() => {
    if (!shape) {
      onDone()
    }
  }, [shape, onDone])

  if (!shape) return null

  const { zoom, offsetX, offsetY } = viewport
  const sx = shape.x * zoom + offsetX
  const sy = shape.y * zoom + offsetY
  const fontSize = (shape.fontSize ?? 16) * zoom

  function handleBlur(): void {
    const val = ref.current?.value ?? ''
    if (!val.trim() && editing.isNew) {
      cancelText(editing.shapeId)
    } else {
      commitText(editing.shapeId, val)
    }
    onDone()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Prevent delete/undo shortcuts from firing while editing
    e.stopPropagation()

    if (e.key === 'Escape') {
      e.preventDefault()
      if (editing.isNew) cancelText(editing.shapeId)
      onDone()
      return
    }
    // Plain Enter commits; Shift+Enter inserts newline (default textarea behavior)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ref.current?.blur()
    }
  }

  return (
    <textarea
      ref={ref}
      defaultValue={shape.content ?? ''}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: sx,
        top: sy,
        minWidth: 80,
        width: (shape.width || 200) * zoom,
        fontSize,
        fontFamily: shape.fontFamily ?? 'system-ui, sans-serif',
        fontWeight: shape.fontWeight ?? 'normal',
        textAlign: shape.textAlign ?? 'left',
        lineHeight: 1.4,
        border: '1.5px dashed #6366f1',
        borderRadius: 2,
        background: 'rgba(255,255,255,0.9)',
        resize: 'none',
        outline: 'none',
        zIndex: 200,
        padding: '2px 4px',
        color: shape.stroke,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    />
  )
}
