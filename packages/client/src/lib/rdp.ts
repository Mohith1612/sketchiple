/** Ramer–Douglas–Peucker polyline simplification. */
export function rdp(pts: [number, number][], epsilon: number): [number, number][] {
  if (pts.length < 3) return pts.slice()
  let maxDist = 0
  let idx = 0
  const end = pts.length - 1
  for (let i = 1; i < end; i++) {
    const d = perpDist(pts[i]!, pts[0]!, pts[end]!)
    if (d > maxDist) {
      maxDist = d
      idx = i
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(pts.slice(0, idx + 1), epsilon)
    const right = rdp(pts.slice(idx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [pts[0]!, pts[end]!]
}

function perpDist(
  p: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}
