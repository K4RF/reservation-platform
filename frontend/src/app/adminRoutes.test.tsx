import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'
import { clearAccessToken, getRoleHint, getRefreshToken, setTokenPair } from '../state/accessToken'
import { apiClient } from '../api/client'
import { accessTokenWithExpiry } from '../test/jwt'
import { accommodationPage } from '../test/accommodation'

const sections = [
  ['/admin/accommodations', '숙소 관리'],
  ['/admin/rooms', '객실 관리'],
  ['/admin/prices', '가격 관리'],
  ['/admin/inventories', '재고 관리'],
] as const
const paths = ['/admin', ...sections.map(([path]) => path), '/admin/unsupported']
function signIn(role = 'ADMIN') {
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
    'refresh',
  )
}
function History() {
  const location = useLocation(),
    navigate = useNavigate()
  return (
    <>
      <output data-testid="location">{location.pathname + location.search + location.hash}</output>
      <button onClick={() => navigate(-1)}>뒤로</button>
      <button onClick={() => navigate(1)}>앞으로</button>
    </>
  )
}
function renderAt(path = '/admin') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <History />
      </MemoryRouter>
    </AuthProvider>,
  )
}
const navigation = () => screen.getByRole('navigation', { name: '관리 메뉴' })
const submitLogin = () => {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'admin@example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))
}

describe('Admin shared layout and existing role guard', () => {
  it.each(sections.filter(([path]) => path !== '/admin/accommodations'))(
    'supports direct ADMIN entry at %s without sending management requests',
    (path, label) => {
      signIn()
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      renderAt(path)
      expect(screen.getAllByRole('main')).toHaveLength(1)
      expect(screen.getByRole('heading', { name: '관리자 영역', level: 1 })).toBeTruthy()
      expect(screen.getByRole('heading', { name: label, level: 2 })).toBeTruthy()
      expect(screen.getByText('관리 화면 준비 중')).toBeTruthy()
      expect(
        within(navigation()).getByRole('link', { name: label }).getAttribute('aria-current'),
      ).toBe('page')
      expect(
        within(navigation()).getByRole('link', { name: '관리 홈' }).getAttribute('aria-current'),
      ).toBeNull()
      expect(within(navigation()).getAllByRole('link')).toHaveLength(5)
      expect(screen.queryByRole('form')).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it('keeps one layout while switching menus and navigating history, with no unsupported business menus', async () => {
    signIn()
    const fetch = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', fetch)
    renderAt()
    const nav = navigation()
    expect(within(nav).getByRole('link', { name: '관리 홈' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/admin', ...sections.map(([path]) => path)])
    for (const [path, label] of sections) {
      fireEvent.click(within(nav).getByRole('link', { name: label }))
      await screen.findByRole('heading', { name: label, level: 2 })
      expect(navigation()).toBe(nav)
      expect(screen.getByTestId('location').textContent).toBe(path)
    }
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }))
    await screen.findByRole('heading', { name: '가격 관리', level: 2 })
    fireEvent.click(screen.getByRole('button', { name: '앞으로' }))
    await screen.findByRole('heading', { name: '재고 관리', level: 2 })
    expect(screen.getByRole('link', { name: '내 예약으로 이동' }).getAttribute('href')).toBe(
      '/reservations',
    )
    expect(screen.getByRole('link', { name: '내 예약' }).getAttribute('href')).toBe('/reservations')
    expect(
      within(nav).queryByRole('link', {
        name: /예약|사용자|권한|통계|매출|Dashboard|결제|Kafka|Audit/,
      }),
    ).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toMatch(/\/accommodations\?/)
  })
  it.each(paths)('redirects anonymous %s before mounting the Admin layout', (path) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    renderAt(path)
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(paths)('blocks USER %s without login loops or management requests', (path) => {
    signIn('USER')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    renderAt(path)
    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe(path)
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('fails closed for unknown JWT role hints', () => {
    signIn('SUPERUSER')
    renderAt('/admin/prices')
    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
  })
  it.each(['/admin/reservations', '/admin/users', '/admin/reports', '/admin/rooms/unknown'])(
    'shows protected Not Found for unsupported %s',
    (path) => {
      signIn()
      const fetch = vi.fn()
      vi.stubGlobal('fetch', fetch)
      renderAt(path)
      expect(screen.getByRole('heading', { name: '관리 페이지를 찾을 수 없습니다.' })).toBeTruthy()
      fireEvent.click(screen.getByRole('link', { name: '관리 홈으로 돌아가기' }))
      expect(screen.getByRole('heading', { name: '관리 홈', level: 2 })).toBeTruthy()
      expect(fetch).not.toHaveBeenCalled()
    },
  )
  it.each(['ADMIN', 'USER'])(
    'rechecks %s after actual email login and restores only the original deep destination',
    async (role) => {
      const fetch = vi.fn().mockImplementation(() =>
        Response.json({
          accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', role),
          refreshToken: 'refresh',
          tokenType: 'Bearer',
        }),
      )
      vi.stubGlobal('fetch', fetch)
      renderAt('/admin/inventories?roomId=3#calendar')
      expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
      submitLogin()
      await screen.findByRole('heading', {
        name: role === 'ADMIN' ? '재고 관리' : '접근 권한이 없습니다.',
      })
      expect(screen.getByTestId('location').textContent).toBe(
        '/admin/inventories?roomId=3#calendar',
      )
      expect(fetch).toHaveBeenCalledOnce()
      expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/login$/)
      expect(new Headers(fetch.mock.calls[0][1].headers).has('Authorization')).toBe(false)
    },
  )
  it('clears the Admin layout immediately when a new USER session replaces it', () => {
    signIn()
    renderAt('/admin/rooms')
    expect(navigation()).toBeTruthy()
    act(() => signIn('USER'))
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
  })
  it('requires re-login after full-reload token loss, not fabricated persisted ADMIN state', async () => {
    signIn()
    const first = renderAt('/admin/prices')
    expect(screen.getByRole('heading', { name: '가격 관리', level: 2 })).toBeTruthy()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    first.unmount()
    clearAccessToken() // Module-reload token loss itself is also covered by SessionReload.test.ts.
    expect(getRoleHint()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    const fetch = vi.fn().mockImplementation(() =>
      Response.json({
        accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN'),
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
      }),
    )
    vi.stubGlobal('fetch', fetch)
    renderAt('/admin/prices')
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
    submitLogin()
    await screen.findByRole('heading', { name: '가격 관리', level: 2 })
    expect(navigation()).toBeTruthy()
  })
  it('uses shared 401 recovery and never retains Admin content after failed reissue', async () => {
    signIn()
    const fetch = vi.fn((url: string) =>
      Response.json(
        { status: 401, code: 'AUTH_001', message: '인증 거절', path: url },
        { status: 401 },
      ),
    )
    vi.stubGlobal('fetch', fetch)
    renderAt('/admin/inventories')
    let error: unknown
    await act(async () => {
      try {
        await apiClient.request('/rooms/3/inventories?startDate=2030-01-01&endDate=2030-01-02')
      } catch (caught) {
        error = caught
      }
    })
    await screen.findByRole('heading', { name: '로그인' })
    expect(error).toMatchObject({ status: 401, kind: 'http' })
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
    expect(fetch.mock.calls.filter(([url]) => url.includes('/inventories?'))).toHaveLength(1)
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/auth/reissue'))).toHaveLength(1)
    expect(screen.getByText('인증이 만료되었습니다. 다시 로그인해 주세요.')).toBeTruthy()
  })
  it('preserves server 403 details despite an ADMIN UI hint, without retry or inventing a new role', async () => {
    signIn()
    const fetch = vi.fn().mockImplementation(() =>
      Response.json(
        {
          status: 403,
          code: 'AUTH_002',
          message: '관리 권한 거절',
          path: '/api/v1/rooms/3/inventories',
          errors: [],
        },
        { status: 403 },
      ),
    )
    vi.stubGlobal('fetch', fetch)
    renderAt('/admin/inventories')
    let error: unknown
    await act(async () => {
      try {
        await apiClient.request('/rooms/3/inventories?startDate=2030-01-01&endDate=2030-01-02')
      } catch (caught) {
        error = caught
      }
    })
    expect(error).toMatchObject({
      status: 403,
      kind: 'http',
      category: 'forbidden',
      code: 'AUTH_002',
      message: '관리 권한 거절',
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(navigation()).toBeTruthy() // Role hint is not proof that a Backend operation is allowed.
    expect(getRoleHint()).toBe('ADMIN')
  })
  it('unmounts protected navigation while refreshing and resumes with the newly issued ADMIN hint', async () => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn((url: string) =>
      url.endsWith('/auth/reissue')
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : Response.json({ status: 401, code: 'AUTH_001', message: '만료' }, { status: 401 }),
    )
    vi.stubGlobal('fetch', fetch)
    renderAt('/admin/rooms')
    let request!: Promise<unknown>
    await act(async () => {
      request = apiClient
        .request('/rooms/3/inventories?startDate=2030-01-01&endDate=2030-01-02')
        .catch(() => undefined)
    })
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
    expect(screen.getByText('인증 상태를 확인하고 있습니다.')).toBeTruthy()
    fetch.mockImplementation(() => Response.json({ content: [] }))
    await act(async () => {
      finish(
        Response.json({
          accessToken: accessTokenWithExpiry(
            Math.floor(Date.now() / 1000) + 3600,
            'ACCESS',
            'ADMIN',
          ),
          tokenType: 'Bearer',
        }),
      )
      await request
    })
    await screen.findByRole('heading', { name: '객실 관리', level: 2 })
    expect(screen.getByTestId('location').textContent).toBe('/admin/rooms')
  })
  it('uses the shared logout flow and hides management UI before protected re-entry', async () => {
    signIn()
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    renderAt('/admin/rooms')
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    await screen.findByRole('heading', { name: '로그인' })
    expect(screen.queryByRole('navigation', { name: '관리 메뉴' })).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toMatch(/\/auth\/logout$/)
  })
})
