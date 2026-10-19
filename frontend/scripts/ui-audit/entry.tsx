import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../../src/app/routes'
import { AuthProvider } from '../../src/state/AuthProvider'
import { setTokenPair } from '../../src/state/accessToken'
import { accessTokenWithExpiry } from '../../src/test/jwt'
import { auditResponse } from './responses'
import type { AuditScenario } from './responses'
import '../../src/index.css'

const params = new URLSearchParams(location.search)
const role = params.get('role')
const scenario = params.get('scenario') ?? 'ready'
if (!['ready', 'empty', 'error', 'loading', 'cancelled'].includes(scenario))
  throw new Error('Unknown audit scenario')
if (role === 'USER' || role === 'ADMIN')
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
    'audit-only-refresh',
  )
document.title = `UI Audit — ${role ?? 'anonymous'} / ${scenario} / fixtures only`

window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
  if (scenario === 'loading' && method.toUpperCase() === 'GET')
    return new Promise<Response>((_, reject) => {
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
        once: true,
      })
    })
  return Promise.resolve(auditResponse(url, method, scenario as AuditScenario))
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <MemoryRouter initialEntries={[params.get('path') ?? '/']}>
      <AppRoutes />
    </MemoryRouter>
  </AuthProvider>,
)
