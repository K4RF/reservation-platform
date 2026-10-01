import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { accessTokenWithExpiry } from '../test/jwt'
import { apiClient } from '../api/client'
import { getAccessToken, setAccessToken, setTokenPair } from './accessToken'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function AuthProbe() {
  const { state, signIn, logout } = useAuth()
  return (
    <>
      <output>{state.status}</output>
      <button
        type="button"
        onClick={() => signIn(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')}
      >
        Sign in
      </button>
      <button type="button" onClick={() => void logout()}>
        Log out
      </button>
    </>
  )
}

describe('AuthProvider', () => {
  it('shares auth state, restores it across provider remounts, and clears it after logout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const first = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('anonymous')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('authenticated')).toBeTruthy()

    first.unmount()
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    expect(screen.getByText('authenticated')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Log out' })))
    expect(screen.getByText('anonymous')).toBeTruthy()
  })

  it('does not discard a newer sign-in when an older logout completes late', async () => {
    let complete!: (response: Response) => void
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await act(async () => complete(new Response(null, { status: 204 })))

    expect(screen.getByText('authenticated')).toBeTruthy()
    expect(getAccessToken()).not.toBeNull()
  })

  it('requires login when an expired token cannot be reissued', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('authenticated')).toBeTruthy()

    await act(async () => vi.advanceTimersByTimeAsync(61_000))
    expect(screen.getByText('reauth_required')).toBeTruthy()
  })

  it('keeps the session authenticated when the expiry timer reissues successfully', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 1), 'refresh')
    const nextToken = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 120)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ accessToken: nextToken, tokenType: 'Bearer' })),
      )
    vi.stubGlobal('fetch', fetchMock)
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    await act(async () => vi.advanceTimersByTimeAsync(2_000))

    expect(screen.getByText('authenticated')).toBeTruthy()
    expect(getAccessToken()).toBe(nextToken)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('clears the visible auth state when a protected API returns 401', async () => {
    setAccessToken(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    expect(screen.getByText('authenticated')).toBeTruthy()

    await act(async () => {
      await expect(apiClient.request('/reservations')).rejects.toMatchObject({ status: 401 })
    })

    expect(screen.getByText('reauth_required')).toBeTruthy()
  })
})
