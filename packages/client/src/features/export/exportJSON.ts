import { getShapesForExport } from './exportUtils.js'

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportToJSON(options?: { selectedOnly?: boolean }): void {
  const selectedOnly = options?.selectedOnly ?? false
  const shapes = getShapesForExport(selectedOnly)
  const payload = JSON.stringify({ version: 1, shapes }, null, 2)
  downloadBlob(
    new Blob([payload], { type: 'application/json' }),
    selectedOnly ? 'canvas-draw.selected.json' : 'canvas-draw.json',
  )
}
