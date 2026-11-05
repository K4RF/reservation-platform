import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../../src/app/routes'
import { saveGoogleReturn } from '../../src/app/loginReturn'
import { createGoogleLoginStartUrl } from '../../src/api/googleOAuth2'
import { AuthProvider } from '../../src/state/AuthProvider'
import { setTokenPair } from '../../src/state/accessToken'
import { accessTokenWithExpiry } from '../../src/test/jwt'
import { auditResponse } from './responses'
import type { AuditScenario, AuditBooking, AuditAdmin } from './responses'
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
const admin = params.get('admin') ?? 'blocked'
if (!['blocked', 'policy-success', 'policy-error'].includes(admin))
  throw new Error('Unknown audit Admin outcome')
const auth = params.get('auth') ?? 'blocked'
if (
  !['blocked', 'signup-success', 'login-error', 'callback-pending', 'callback-error'].includes(auth)
)
  throw new Error('Unknown audit Auth state')
let entry: string | { pathname: string; state: { signupCompleted: boolean; from: string } } =
  params.get('path') ?? '/'
const authReturn =
  '/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2&roomId=3'
if (auth === 'signup-success') {
  entry = { pathname: '/login', state: { signupCompleted: true, from: authReturn } }
}
if (auth === 'callback-pending' || auth === 'callback-error') {
  // Use a synthetic one-time code and state to exercise the real callback, without Google.
  const start = new URL(createGoogleLoginStartUrl(location.origin))
  saveGoogleReturn(authReturn)
  entry = `/oauth2/callback#code=${'a'.repeat(43)}&state=${start.searchParams.get('state')}`
}
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
  const path = new URL(url, location.origin).pathname
  if (method.toUpperCase() === 'POST') {
    if (auth === 'login-error' && path === '/api/v1/auth/login') {
      return Promise.resolve(
        Response.json({ status: 401, code: 'AUTH_003', message: 'Audit fixture' }, { status: 401 }),
      )
    }
    if (path === '/api/v1/auth/oauth2/exchange') {
      if (auth === 'callback-error') {
        return Promise.resolve(Response.json({ message: 'Audit fixture' }, { status: 401 }))
      }
      if (auth === 'callback-pending') {
        return new Promise<Response>((_, reject) => {
          const abort = () => reject(new DOMException('Aborted', 'AbortError'))
          if (signal?.aborted) abort()
          else signal?.addEventListener('abort', abort, { once: true })
        })
      }
    }
  }
  if (booking === 'ambiguous' && method.toUpperCase() === 'POST' && path === '/api/v1/reservations')
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
    auditResponse(
      url,
      method,
      scenario as AuditScenario,
      mediaMode,
      booking as AuditBooking,
      role === 'ADMIN' ? (admin as AuditAdmin) : 'blocked',
    ),
  )
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MemoryRouter initialEntries={[entry]}>
      <AppRoutes />
    </MemoryRouter>
  </AuthProvider>,
)
