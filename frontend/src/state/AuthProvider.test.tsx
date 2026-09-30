import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { accessTokenWithExpiry } from '../test/jwt'
import { apiClient } from '../api/client'
import { setAccessToken } from './accessToken'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'

function AuthProbe() {
  const { state, signIn, clearAuthentication } = useAuth()
  return (
    <>
      <output>{state.status}</output>
      <button
        type="button"
        onClick={() => signIn(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))}
      >
        Sign in
      </button>
      <button type="button" onClick={clearAuthentication}>
        Clear authentication
      </button>
    </>
  )
}

describe('AuthProvider', () => {
  it('shares auth state, restores it across provider remounts, and clears it', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Clear authentication' }))
    expect(screen.getByText('anonymous')).toBeTruthy()
  })

  it('returns to anonymous when the in-memory access token expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByText('authenticated')).toBeTruthy()

    act(() => vi.advanceTimersByTime(61_000))
    expect(screen.getByText('anonymous')).toBeTruthy()
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

    expect(screen.getByText('anonymous')).toBeTruthy()
  })
})
