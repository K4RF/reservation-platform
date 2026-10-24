// UI-only, bounded to this document lifetime. No storage, URL, response cache or authentication data.
export interface ExplorationPosition {
  x: number
  y: number
  triggerId: string
}
const positions = new Map<string, ExplorationPosition>()
export function captureExplorationPosition(trigger: HTMLElement): ExplorationPosition {
  return { x: window.scrollX, y: window.scrollY, triggerId: trigger.id }
}
export function restoreExplorationPosition(
  position: ExplorationPosition,
  fallback?: HTMLElement | null,
) {
  const trigger = document.getElementById(position.triggerId) ?? fallback
  trigger?.focus({ preventScroll: true })
  window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' })
}
export function rememberSearchPosition(query: string, trigger: HTMLElement) {
  positions.delete(query)
  positions.set(query, captureExplorationPosition(trigger))
  if (positions.size > 20) positions.delete(positions.keys().next().value!)
}
export function restoreSearchPosition(query: string, fallback: HTMLElement | null) {
  const saved = positions.get(query)
  if (saved) restoreExplorationPosition(saved, fallback)
}
