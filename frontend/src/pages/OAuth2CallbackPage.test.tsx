import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../app/routes'
import { exchangeGoogleLoginCode } from '../api/auth'
import { createGoogleLoginStartUrl } from '../api/googleOAuth2'
import { AuthProvider } from '../state/AuthProvider'
import { getAccessToken, getRefreshToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

vi.mock('../api/auth', () => ({
  exchangeGoogleLoginCode: vi.fn(),
  loginWithEmail: vi.fn(),
  logoutFromBackend: vi.fn(),
}))

afterEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
})

function callbackEntry(fragment: string) {
  const start = new URL(
    createGoogleLoginStartUrl('http://localhost:8080', sessionStorage, new Uint8Array(24).fill(5)),
  )
  return `/oauth2/callback#${fragment}&state=${start.searchParams.get('state')}`
}

function renderCallback(entry: string) {
  return render(
    <StrictMode>
      <AuthProvider>
        <MemoryRouter initialEntries={[entry]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </StrictMode>,
  )
}

describe('Google callback page', () => {
  it('exchanges the one-time code and establishes the same auth state as email login', async () => {
    const code = 'a'.repeat(43)
    const accessToken = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    vi.mocked(exchangeGoogleLoginCode).mockResolvedValue({
      accessToken,
      refreshToken: 'google-refresh',
      tokenType: 'Bearer',
    })

    renderCallback(callbackEntry(`code=${code}`))

    expect(await screen.findByRole('heading', { name: 'Reservation Platform' })).toBeTruthy()
    expect(exchangeGoogleLoginCode).toHaveBeenCalledWith(code)
    expect(getAccessToken()).toBe(accessToken)
    expect(getRefreshToken()).toBe('google-refresh')
    expect(sessionStorage.length).toBe(0)
  })

  it('shows a cancellation without attempting a code exchange', async () => {
    renderCallback(callbackEntry('error=cancelled'))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Google 로그인이 취소되었습니다.',
    )
    expect(exchangeGoogleLoginCode).not.toHaveBeenCalled()
  })

  it('rejects an unsolicited callback and displays exchange errors', async () => {
    renderCallback(`/oauth2/callback#code=${'a'.repeat(43)}&state=invalid`)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      '로그인 요청을 확인할 수 없습니다. 다시 시작해 주세요.',
    )
    expect(exchangeGoogleLoginCode).not.toHaveBeenCalled()
  })

  it('keeps the user signed out when code exchange fails', async () => {
    vi.mocked(exchangeGoogleLoginCode).mockRejectedValue(new Error('expired'))
    renderCallback(callbackEntry(`code=${'a'.repeat(43)}`))

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Google 로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
    )
    expect(getAccessToken()).toBeNull()
  })
})
