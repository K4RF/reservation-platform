// Opt-in local diagnostics only. No requests, storage, DOM changes or production import.
export function startPerformanceProbe() {
  const types = ['layout-shift', 'largest-contentful-paint', 'resource'] as const
  const supported =
    typeof PerformanceObserver === 'undefined'
      ? []
      : (PerformanceObserver.supportedEntryTypes ?? [])
  console.info(
    'UI_AUDIT_PERFORMANCE',
    JSON.stringify({ supported: types.filter((type) => supported.includes(type)) }),
  )
  const observers: PerformanceObserver[] = []
  for (const type of types) {
    if (!supported.includes(type)) continue
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries().flatMap((entry) => {
        const data: Record<string, unknown> = entry.toJSON()
        // Resource URLs/element IDs/shift sources may contain user input. Never log them.
        if (type === 'resource' && data.initiatorType !== 'img') return []
        const fields =
          type === 'layout-shift'
            ? ['startTime', 'value', 'hadRecentInput']
            : type === 'largest-contentful-paint'
              ? ['startTime', 'renderTime', 'loadTime', 'size']
              : ['startTime', 'duration', 'transferSize', 'encodedBodySize', 'decodedBodySize']
        return [
          Object.fromEntries(fields.filter((key) => key in data).map((key) => [key, data[key]])),
        ]
      })
      if (entries.length) console.info('UI_AUDIT_PERFORMANCE', JSON.stringify({ type, entries }))
    })
    observer.observe({ type, buffered: true })
    observers.push(observer)
  }
  return () => observers.forEach((observer) => observer.disconnect())
}
