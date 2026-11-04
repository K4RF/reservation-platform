import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../../src/app/routes'
import { AuthProvider } from '../../src/state/AuthProvider'
import { setTokenPair } from '../../src/state/accessToken'
import { accessTokenWithExpiry } from '../../src/test/jwt'
import { auditResponse } from './responses'
import type { AuditScenario, AuditBooking } from './responses'
import { startPerformanceProbe } from './performanceProbe'
import '../../src/index.css'

const params = new URLSearchParams(location.search)
if (params.get('metrics') === '1') {
  const stop = startPerformanceProbe()
  window.addEventListener('pagehide', stop, { once: true })
  if (import.meta.hot) import.meta.hot.dispose(stop)
}
const role = params.get('role')
const scenario = params.get('scenario') ?? 'ready'
const textScale = params.get('textScale') ?? '100'
const mediaMode = params.get('media') ?? 'missing'
const booking = params.get('booking') ?? 'blocked'
if (!['blocked', 'success', 'ambiguous'].includes(booking))
  throw new Error('Unknown audit Booking outcome')
if (!['present', 'missing', 'failed', 'partial'].includes(mediaMode))
  throw new Error('Unknown audit Media mode')
if (!['100', '200'].includes(textScale)) throw new Error('Unknown audit text scale')
// Text/rem enlargement probe only, not browser zoom or a production preference.
document.documentElement.style.fontSize = `${textScale}%`
if (!['ready', 'empty', 'error', 'loading', 'cancelled', 'stress', 'comparison'].includes(scenario))
  throw new Error('Unknown audit scenario')
if (role === 'USER' || role === 'ADMIN')
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
    'audit-only-refresh',
  )
document.title = `UI Audit — ${role ?? 'anonymous'} / ${scenario} / booking=${booking} / fixtures only`

window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  if (
    booking === 'ambiguous' &&
    method.toUpperCase() === 'POST' &&
    new URL(url, location.origin).pathname === '/api/v1/reservations'
  )
    return new Promise<Response>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort)
        resolve(auditResponse(url, method, scenario as AuditScenario, mediaMode, 'ambiguous'))
      }, 5000)
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
    })
  if (scenario === 'loading' && method.toUpperCase() === 'GET')
    return new Promise<Response>((_, reject) => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
        once: true,
      })
    })
  return Promise.resolve(
    auditResponse(url, method, scenario as AuditScenario, mediaMode, booking as AuditBooking),
  )
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MemoryRouter initialEntries={[params.get('path') ?? '/']}>
      <AppRoutes />
    </MemoryRouter>
  </AuthProvider>,
)
