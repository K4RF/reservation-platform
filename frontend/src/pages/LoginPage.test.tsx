import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../app/routes'
import { loginWithEmail, logoutFromBackend } from '../api/auth'
import { apiClient } from '../api/client'
import { ApiError } from '../api/errors'
import { AuthProvider } from '../state/AuthProvider'
import { getAccessToken, getRefreshToken, setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

vi.mock('../api/auth', () => ({ loginWithEmail: vi.fn(), logoutFromBackend: vi.fn() }))

const tokens = {
  accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60),
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
} as const

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(logoutFromBackend).mockResolvedValue(undefined)
})

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

function enterValidDetails() {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: ' Member@Example.com ' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Password123!' } })
}

describe('login flow', () => {
  it('renders the login route, signup link, and blocks invalid local input', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: '회원가입' }).getAttribute('href'),
    ).toBe('/signup')

    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    expect(screen.getByText('이메일을 입력해 주세요.')).toBeTruthy()
    expect(screen.getByText('비밀번호를 입력해 주세요.')).toBeTruthy()
    expect(loginWithEmail).not.toHaveBeenCalled()
  })

  it('submits once, then redirects home with an in-memory authentication state', async () => {
    let complete!: (value: typeof tokens) => void
    vi.mocked(loginWithEmail).mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    const { container } = renderLogin()
    enterValidDetails()

    const form = container.querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(loginWithEmail).toHaveBeenCalledOnce()
    expect(loginWithEmail).toHaveBeenCalledWith({
      email: 'Member@Example.com',
      password: 'Password123!',
    })
    expect(screen.getByRole('button', { name: '로그인' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('처리하고 있습니다')

    complete(tokens)
    expect(await screen.findByRole('heading', { name: 'Reservation Platform' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('로그인 상태입니다')
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeTruthy()
    expect(getAccessToken()).toBe(tokens.accessToken)
    expect(getRefreshToken()).toBe(tokens.refreshToken)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    expect(await screen.findByText('로그아웃되었습니다.')).toBeTruthy()
    expect(logoutFromBackend).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: '로그인' })).toBeTruthy()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    const protectedFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', protectedFetch)
    await expect(apiClient.request('/reservations')).rejects.toMatchObject({ status: 401 })
    expect(
      new Headers((protectedFetch.mock.calls[0][1] as RequestInit).headers).has('Authorization'),
    ).toBe(false)
  })

  it('clears local credentials and warns when server logout cannot be confirmed', async () => {
    setTokenPair(tokens.accessToken, tokens.refreshToken)
    vi.mocked(logoutFromBackend).mockRejectedValue(new ApiError('offline', { kind: 'network' }))
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '이 브라우저의 인증은 종료했지만 서버 로그아웃은 확인하지 못했습니다.',
    )
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('blocks duplicate logout clicks while the server request is pending', async () => {
    setTokenPair(tokens.accessToken, tokens.refreshToken)
    let finish!: () => void
    vi.mocked(logoutFromBackend).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    const pendingButton = screen.getByRole('button', { name: '로그아웃 중…' })
    expect(pendingButton.hasAttribute('disabled')).toBe(true)
    fireEvent.click(pendingButton)
    expect(logoutFromBackend).toHaveBeenCalledOnce()

    finish()
    expect(await screen.findByText('로그아웃되었습니다.')).toBeTruthy()
  })

  it('returns to login with a message when token reissue fails', async () => {
    setTokenPair(tokens.accessToken, tokens.refreshToken)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    )

    await act(async () => {
      await expect(apiClient.request('/reservations')).rejects.toMatchObject({ status: 401 })
    })

    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('인증이 만료되었습니다')
    expect(getRefreshToken()).toBeNull()
  })

  it('shows invalid credentials without identifying which credential was wrong', async () => {
    vi.mocked(loginWithEmail).mockRejectedValue(
      new ApiError('이메일 또는 비밀번호가 올바르지 않습니다.', {
        kind: 'http',
        status: 401,
        category: 'unauthorized',
        code: 'AUTH_003',
      }),
    )
    renderLogin()
    enterValidDetails()
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    )
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
  })

  it('maps backend validation errors to the matching input', async () => {
    vi.mocked(loginWithEmail).mockRejectedValue(
      new ApiError('입력값이 올바르지 않습니다.', {
        kind: 'http',
        status: 400,
        category: 'bad_request',
        code: 'COMMON_001',
        fieldErrors: [{ field: 'email', message: '이메일 형식이 올바르지 않습니다.' }],
      }),
    )
    renderLogin()
    enterValidDetails()
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('이메일 형식이 올바르지 않습니다.')).toBeTruthy()
    expect(screen.getByLabelText('이메일').getAttribute('aria-invalid')).toBe('true')
  })

  it.each(['network', 'timeout'] as const)(
    'shows a retryable message for %s failure',
    async (kind) => {
      vi.mocked(loginWithEmail).mockRejectedValue(new ApiError('Connection failed', { kind }))
      renderLogin()
      enterValidDetails()
      fireEvent.click(screen.getByRole('button', { name: '로그인' }))

      await waitFor(() => {
        expect(screen.getByRole('alert').textContent).toContain('서버에 연결하지 못했습니다')
      })
    },
  )
})
