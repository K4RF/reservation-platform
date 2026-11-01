import { useSyncExternalStore } from 'react'

const query = '(min-width: 48rem)'
function subscribe(change: () => void) {
  const media = window.matchMedia?.(query)
  media?.addEventListener('change', change)
  return () => media?.removeEventListener('change', change)
}
export function useWideSearchLayer() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(query).matches ?? false,
    () => false,
  )
}
