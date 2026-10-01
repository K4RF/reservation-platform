import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'
import { clearAccessToken, setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'
import { loginWithEmail } from '../api/auth'
import { apiClient } from '../api/client'

vi.mock('../api/auth', () => ({ loginWithEmail: vi.fn(), logoutFromBackend: vi.fn() }))
beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location">{location.pathname + location.search + location.hash}</output>
  )
}
function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function signIn(role = 'USER', seconds = 60) {
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + seconds, 'ACCESS', role),
    'refresh',
  )
}

describe('protected and role routes', () => {
  it.each(['/reservations', '/admin', '/admin/rooms'])(
    'redirects anonymous direct access at %s to login',
    (path) => {
      renderAt(path)
      expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
      expect(screen.queryByRole('link', { name: '관리자' })).toBeNull()
    },
  )
  it.each(['USER', 'ADMIN'])('allows %s to enter the member area', (role) => {
    signIn(role)
    renderAt('/reservations')
    expect(screen.getByRole('heading', { name: '내 예약' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '내 예약' })).toBeTruthy()
  })
  it('allows ADMIN direct access and exposes its navigation', () => {
    signIn('ADMIN')
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: '관리자 영역' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '관리자' })).toBeTruthy()
  })
  it.each(['/admin', '/admin/rooms'])('blocks USER at %s without a login loop', (path) => {
    signIn()
    renderAt(path)
    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe(path)
  })
  it('fails closed on an unknown role', () => {
    signIn('SUPERUSER')
    renderAt('/admin')
    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull()
  })
  it('returns to the original path including query and fragment after email login', async () => {
    vi.mocked(loginWithEmail).mockResolvedValue({
      accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60),
      refreshToken: 'refresh',
      tokenType: 'Bearer',
    })
    renderAt('/reservations?status=CONFIRMED#result')
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(await screen.findByRole('heading', { name: '내 예약' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/reservations?status=CONFIRMED#result')
  })
  it('checks the returned destination role again after login', async () => {
    vi.mocked(loginWithEmail).mockResolvedValue({
      accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60),
      refreshToken: 'refresh',
      tokenType: 'Bearer',
    })
    renderAt('/admin')
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(await screen.findByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
  })
  it('keeps the URL and hides protected content while refreshing, then applies the updated role', async () => {
    signIn('ADMIN')
    let finish!: (response: Response) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/admin')
    let request!: Promise<unknown>
    await act(async () => {
      request = apiClient.request('/rooms/1').catch(() => undefined)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    await act(async () => finish(new Response('{}', { status: 401 })))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText('인증 상태를 확인하고 있습니다.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '관리자 영역' })).toBeNull()
    expect(screen.getByTestId('location').textContent).toBe('/admin')
    fetchMock.mockResolvedValue(new Response('{}'))
    await act(async () => {
      finish(
        new Response(
          JSON.stringify({
            accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 120),
            tokenType: 'Bearer',
          }),
        ),
      )
      await request
    })
    expect(screen.getByRole('heading', { name: '접근 권한이 없습니다.' })).toBeTruthy()
  })
  it('treats a cleared in-memory session (full reload behavior) as anonymous', () => {
    signIn()
    const first = renderAt('/reservations')
    expect(screen.getByRole('heading', { name: '내 예약' })).toBeTruthy()
    first.unmount()
    clearAccessToken()
    renderAt('/reservations')
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
  })
  it('waits on an expired in-memory session during provider remount, then redirects on refresh failure', async () => {
    signIn('USER', 1)
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 2_000)
    let finish!: (response: Response) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/reservations?status=CONFIRMED')
    expect(screen.getByText('인증 상태를 확인하고 있습니다.')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/reservations?status=CONFIRMED')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    await act(async () => finish(new Response('{}', { status: 401 })))
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(screen.getByText('인증이 만료되었습니다. 다시 로그인해 주세요.')).toBeTruthy()
    clock.mockRestore()
    vi.mocked(loginWithEmail).mockResolvedValue({
      accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60),
      refreshToken: 'refresh',
      tokenType: 'Bearer',
    })
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(await screen.findByRole('heading', { name: '내 예약' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/reservations?status=CONFIRMED')
  })
})
