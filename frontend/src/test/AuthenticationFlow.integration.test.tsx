import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../app/routes'
import { apiClient } from '../api/client'
import { createGoogleLoginStartUrl } from '../api/googleOAuth2'
import { saveGoogleReturn } from '../app/loginReturn'
import { AuthProvider } from '../state/AuthProvider'
import { useAuth } from '../state/useAuth'
import { getAccessToken, getRefreshToken } from '../state/accessToken'
import { accessTokenWithExpiry } from './jwt'

// Mock only the HTTP boundary: real forms, API functions/client, token store, Provider and Router.
function Probe() {
  const { state } = useAuth()
  const location = useLocation()
  return (
    <>
      <span data-testid="auth">
        {state.status}
        {state.status === 'authenticated' ? `:${state.role}` : ''}
      </span>
      <span data-testid="location">{location.pathname + location.search + location.hash}</span>
    </>
  )
}
function renderFlow(path: string) {
  return render(
    <StrictMode>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <Probe />
        </MemoryRouter>
      </AuthProvider>
    </StrictMode>,
  )
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function pair(role = 'USER', seconds = 60) {
  return {
    accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + seconds, 'ACCESS', role),
    refreshToken: 'test-refresh',
    tokenType: 'Bearer',
  }
}
function submit(name: string) {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'flow@example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
  fireEvent.click(screen.getByRole('button', { name }))
}
function http(handler: (path: string, init: RequestInit) => Response | Promise<Response>) {
  const mock = vi.fn(async (url: string, init: RequestInit) =>
    handler(url.replace('/api/v1', ''), init),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}
function calls(mock: ReturnType<typeof http>, path: string) {
  return mock.mock.calls.filter(([url]) => url === `/api/v1${path}`)
}
function authorization(init: RequestInit) {
  return new Headers(init.headers).get('Authorization')
}
afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('authentication user lifecycle (HTTP boundary integration)', () => {
  it('connects signup, email login, bearer request, logout and protected re-entry', async () => {
    const tokens = pair()
    const mock = http((path, init) => {
      if (path === '/members') {
        expect(authorization(init)).toBeNull()
        expect(JSON.parse(init.body as string)).toEqual({
          email: 'flow@example.com',
          password: 'Password123!',
        })
        return json({ memberId: 7, email: 'flow@example.com', role: 'USER' }, 201)
      }
      if (path === '/auth/login') {
        expect(authorization(init)).toBeNull()
        return json(tokens)
      }
      expect(authorization(init)).toBe(`Bearer ${tokens.accessToken}`)
      return path === '/auth/logout' ? new Response(null, { status: 204 }) : json({ content: [] })
    })
    const first = renderFlow('/signup')
    submit('회원가입')
    expect(
      await screen.findByText('회원가입이 완료되었습니다. 로그인 화면에서 계속 진행해 주세요.'),
    ).toBeTruthy()
    expect(screen.getByTestId('auth').textContent).toBe('anonymous')
    fireEvent.click(screen.getByRole('link', { name: '로그인' }))
    submit('로그인')
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('authenticated:USER'))
    fireEvent.click(screen.getByRole('link', { name: '내 예약' }))
    expect(screen.getByRole('heading', { name: '내 예약' })).toBeTruthy()
    await act(async () => {
      await expect(apiClient.request('/reservations')).resolves.toEqual({ content: [] })
    })
    expect(getRefreshToken()).toBe(tokens.refreshToken)
    expect(sessionStorage.length).toBe(0)
    expect(localStorage.length).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(await screen.findByText('로그아웃되었습니다.')).toBeTruthy()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(calls(mock, '/auth/logout')).toHaveLength(1)
    expect(screen.getByTestId('auth').textContent).toBe('anonymous')
    fireEvent.click(screen.getByRole('link', { name: '홈' }))
    expect(screen.queryByRole('link', { name: '내 예약' })).toBeNull()
    // New navigation to the protected URL must require login again.
    first.unmount()
    const second = renderFlow('/reservations')
    expect(second.container.querySelector('h1')?.textContent).toBe('로그인')
  })

  it.each(['USER', 'ADMIN'])(
    'returns %s login to the requested admin URL and applies role policy',
    async (role) => {
      http(() => json(pair(role)))
      renderFlow('/admin')
      expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
      submit('로그인')
      expect(
        await screen.findByRole('heading', {
          name: role === 'ADMIN' ? '관리자 영역' : '접근 권한이 없습니다.',
        }),
      ).toBeTruthy()
      expect(screen.getByTestId('location').textContent).toBe('/admin')
      expect(Boolean(screen.queryByRole('link', { name: '관리자' }))).toBe(role === 'ADMIN')
    },
  )

  it('coalesces concurrent 401s, shows loading without losing the route, and replays with the new token', async () => {
    const old = pair()
    const next = pair('USER', 120)
    let finish!: (response: Response) => void
    const mock = http((path, init) => {
      if (path === '/auth/login') return json(old)
      if (path === '/auth/reissue') {
        expect(authorization(init)).toBeNull()
        expect(JSON.parse(init.body as string)).toEqual({ refreshToken: old.refreshToken })
        return new Promise((resolve) => {
          finish = resolve
        })
      }
      return authorization(init) === `Bearer ${old.accessToken}`
        ? json({}, 401)
        : json({ ok: true })
    })
    renderFlow('/reservations?status=CONFIRMED#result')
    submit('로그인')
    await screen.findByRole('heading', { name: '내 예약' })
    let requests!: Promise<unknown[]>
    await act(async () => {
      requests = Promise.all([apiClient.request('/reservations'), apiClient.request('/rooms/1')])
    })
    await waitFor(() => expect(calls(mock, '/auth/reissue')).toHaveLength(1))
    expect(screen.getByTestId('auth').textContent).toBe('loading')
    expect(screen.getByText('인증 상태를 확인하고 있습니다.')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/reservations?status=CONFIRMED#result')
    await act(async () => {
      finish(json({ accessToken: next.accessToken, tokenType: 'Bearer' }))
      await expect(requests).resolves.toEqual([{ ok: true }, { ok: true }])
    })
    expect(screen.getByTestId('auth').textContent).toBe('authenticated:USER')
    expect(calls(mock, '/reservations')).toHaveLength(2)
    expect(calls(mock, '/rooms/1')).toHaveLength(2)
    expect(getAccessToken()).toBe(next.accessToken)
  })

  it('reissues an expired access token through the Provider timer and uses it for subsequent APIs', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    const old = pair('USER', 1)
    const next = pair('USER', 120)
    const mock = http((path) =>
      path === '/auth/login'
        ? json(old)
        : path === '/auth/reissue'
          ? json({ accessToken: next.accessToken, tokenType: 'Bearer' })
          : json({ ok: true }),
    )
    renderFlow('/reservations')
    await act(async () => submit('로그인'))
    await act(async () => vi.advanceTimersByTimeAsync(2_000))
    expect(calls(mock, '/auth/reissue')).toHaveLength(1)
    expect(screen.getByTestId('auth').textContent).toBe('authenticated:USER')
    await act(async () => {
      await apiClient.request('/reservations')
    })
    expect(authorization(calls(mock, '/reservations')[0][1])).toBe(`Bearer ${next.accessToken}`)
  })

  it.each(['reissue401', 'reissueNetwork', 'replay401'])(
    'clears the session and preserves return route on %s',
    async (scenario) => {
      const tokens = pair()
      const mock = http((path) => {
        if (path === '/auth/login') return json(tokens)
        if (path === '/auth/reissue') {
          if (scenario === 'reissueNetwork') throw new TypeError('offline')
          return scenario === 'replay401'
            ? json({ accessToken: pair('USER', 120).accessToken, tokenType: 'Bearer' })
            : json({}, 401)
        }
        return json({}, 401)
      })
      renderFlow('/reservations?status=CONFIRMED')
      submit('로그인')
      await screen.findByRole('heading', { name: '내 예약' })
      await act(async () => {
        await expect(apiClient.request('/reservations')).rejects.toMatchObject({
          kind: scenario === 'reissueNetwork' ? 'network' : 'http',
        })
      })
      expect(screen.getByTestId('auth').textContent).toBe('reauth_required')
      expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
      expect(getAccessToken()).toBeNull()
      expect(getRefreshToken()).toBeNull()
      expect(calls(mock, '/auth/reissue')).toHaveLength(1)
      submit('로그인')
      await screen.findByRole('heading', { name: '내 예약' })
      expect(screen.getByTestId('location').textContent).toBe('/reservations?status=CONFIRMED')
    },
  )

  it.each(['forbidden', 'network'])(
    'does not logout or reissue for a protected API %s failure',
    async (scenario) => {
      const tokens = pair()
      const mock = http((path) => {
        if (path === '/auth/login') return json(tokens)
        if (scenario === 'network') throw new TypeError('offline')
        return json(
          {
            status: 403,
            code: 'AUTH_002',
            message: '접근 권한이 없습니다.',
            path: '/api/v1/rooms/1',
            errors: [],
          },
          403,
        )
      })
      renderFlow('/reservations')
      submit('로그인')
      await screen.findByRole('heading', { name: '내 예약' })
      await act(async () => {
        await expect(apiClient.request('/rooms/1')).rejects.toMatchObject(
          scenario === 'network' ? { kind: 'network' } : { status: 403, category: 'forbidden' },
        )
      })
      expect(screen.getByTestId('auth').textContent).toBe('authenticated:USER')
      expect(calls(mock, '/auth/reissue')).toHaveLength(0)
      expect(getAccessToken()).toBe(tokens.accessToken)
    },
  )

  it('connects a validated Google callback to real code exchange, auth state and protected destination', async () => {
    const start = new URL(createGoogleLoginStartUrl('http://localhost:8080'))
    saveGoogleReturn('/reservations?status=CONFIRMED')
    const tokens = pair()
    const mock = http((path, init) => {
      expect(path).toBe('/auth/oauth2/exchange')
      expect(authorization(init)).toBeNull()
      expect(JSON.parse(init.body as string)).toEqual({ code: 'a'.repeat(43) })
      return json(tokens)
    })
    renderFlow(`/oauth2/callback#code=${'a'.repeat(43)}&state=${start.searchParams.get('state')}`)
    await screen.findByRole('heading', { name: '내 예약' })
    expect(mock).toHaveBeenCalledOnce()
    expect(screen.getByTestId('auth').textContent).toBe('authenticated:USER')
    expect(screen.getByTestId('location').textContent).toBe('/reservations?status=CONFIRMED')
    expect(sessionStorage.length).toBe(0)
  })

  it.each(['cancelled', 'stateMismatch', 'exchange401'])(
    'does not create a Google session on %s',
    async (scenario) => {
      const start = new URL(createGoogleLoginStartUrl('http://localhost:8080'))
      saveGoogleReturn('/reservations')
      const mock = http(() => json({}, 401))
      const state = scenario === 'stateMismatch' ? 'unexpected' : start.searchParams.get('state')
      const fragment = scenario === 'cancelled' ? 'error=cancelled' : `code=${'a'.repeat(43)}`
      renderFlow(`/oauth2/callback#${fragment}&state=${state}`)
      expect(await screen.findByRole('alert')).toBeTruthy()
      expect(screen.getByTestId('auth').textContent).toBe('anonymous')
      expect(getAccessToken()).toBeNull()
      expect(getRefreshToken()).toBeNull()
      expect(calls(mock, '/auth/oauth2/exchange')).toHaveLength(scenario === 'exchange401' ? 1 : 0)
      expect(sessionStorage.length).toBe(0)
    },
  )

  it.each([401, 503])(
    'keeps logout loading and warns on HTTP %s without restoring tokens',
    async (status) => {
      const tokens = pair()
      let finish!: (response: Response) => void
      const mock = http((path) =>
        path === '/auth/login'
          ? json(tokens)
          : new Promise((resolve) => {
              finish = resolve
            }),
      )
      renderFlow('/reservations')
      submit('로그인')
      await screen.findByRole('heading', { name: '내 예약' })
      fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
      expect(screen.getByText('로그아웃을 처리하고 있습니다.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: '로그아웃 중…' }))
      await waitFor(() => expect(calls(mock, '/auth/logout')).toHaveLength(1))
      await act(async () => finish(json({}, status)))
      expect(
        await screen.findByText(
          '이 브라우저의 인증은 종료했지만 서버 로그아웃은 확인하지 못했습니다.',
        ),
      ).toBeTruthy()
      expect(screen.getByTestId('auth').textContent).toBe('anonymous')
      expect(getAccessToken()).toBeNull()
      expect(getRefreshToken()).toBeNull()
      expect(calls(mock, '/auth/reissue')).toHaveLength(0)
    },
  )
})
