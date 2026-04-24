/**
 * Shape-count stress harness — pure in-memory, no server required.
 *
 * Measures Yjs Y.Map insert throughput and Zustand-equivalent object spread
 * cost at varying shape counts (100 / 500 / 1000 / 2000).
 *
 * Run: pnpm perf:shapes
 */
import * as Y from 'yjs'

const COUNTS = [100, 500, 1000, 2000]

function makeShape(i: number) {
  return {
    id: `shape-${i}`,
    type: 'rect' as const,
    x: Math.random() * 2000,
    y: Math.random() * 2000,
    width: 100,
    height: 60,
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 2,
    opacity: 1,
  }
}

function makeFreehandShape(i: number, pointCount = 200) {
  const points: number[][] = []
  for (let p = 0; p < pointCount; p++) {
    points.push([Math.random() * 2000, Math.random() * 2000])
  }
  return {
    id: `freehand-${i}`,
    type: 'freehand' as const,
    x: 0,
    y: 0,
    width: 2000,
    height: 2000,
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: 2,
    opacity: 1,
    freehandPoints: points,
  }
}

function bench(label: string, fn: () => void): number {
  const t0 = performance.now()
  fn()
  const elapsed = performance.now() - t0
  return elapsed
}

function formatMs(ms: number) {
  return ms.toFixed(2) + 'ms'
}

console.log('\n=== Shape-count stress harness ===\n')

for (const count of COUNTS) {
  // --- Yjs insert benchmark ---
  const doc = new Y.Doc()
  const shapesMap = doc.getMap<object>('shapes')

  const insertMs = bench(`Yjs insert ${count} rect shapes`, () => {
    doc.transact(() => {
      for (let i = 0; i < count; i++) {
        shapesMap.set(`shape-${i}`, makeShape(i))
      }
    })
  })

  // --- Zustand-style read (iterate + spread) benchmark ---
  const shapes: Record<string, ReturnType<typeof makeShape>> = {}
  for (let i = 0; i < count; i++) shapes[`shape-${i}`] = makeShape(i)

  const readMs = bench(`Object.values iterate ${count} shapes`, () => {
    let total = 0
    for (const s of Object.values(shapes)) total += s.x + s.y
    // prevent dead-code elimination
    if (total < 0) throw new Error('unexpected')
  })

  // --- Freehand path build benchmark (200 pts each) ---
  const freehandShapes = Array.from({ length: count }, (_, i) => makeFreehandShape(i))
  const pathMs = bench(`Build quadratic curves for ${count} freehand shapes (200 pts each)`, () => {
    for (const s of freehandShapes) {
      const pts = s.freehandPoints
      // Simulate Path2D construction cost without actual DOM
      let ax = pts[0]![0], ay = pts[0]![1]
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i]![0] + pts[i + 1]![0]) / 2
        const my = (pts[i]![1] + pts[i + 1]![1]) / 2
        ax = mx; ay = my
      }
      void ax; void ay
    }
  })

  console.log(`count=${count}:`)
  console.log(`  Yjs transact insert:       ${formatMs(insertMs)}  (${formatMs(insertMs / count)}/shape)`)
  console.log(`  Zustand iterate read:      ${formatMs(readMs)}  (${formatMs(readMs / count)}/shape)`)
  console.log(`  Freehand curve compute:    ${formatMs(pathMs)}  (${formatMs(pathMs / count)}/shape)`)
  console.log()
}

console.log('Done. Record these numbers in docs/PERF_BASELINE.md.')
