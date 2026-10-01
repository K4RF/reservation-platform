import { describe, expect, it, vi } from 'vitest'
import { loginWithEmail, logoutFromBackend } from './auth'
import { getAccessToken, setAccessToken, setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
}

describe('loginWithEmail', () => {
  it('posts the backend login fields and returns the token response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(tokens), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))

    await expect(
      loginWithEmail({ email: 'member@example.com', password: 'Password123!' }),
    ).resolves.toEqual(tokens)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/auth\/login$/)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(init.body).toBe(
      JSON.stringify({ email: 'member@example.com', password: 'Password123!' }),
    )
  })

  it.each([
    null,
    { accessToken: '', refreshToken: 'refresh-token', tokenType: 'Bearer' },
    { accessToken: 'access-token', refreshToken: '', tokenType: 'Bearer' },
    { accessToken: 'access-token', refreshToken: 'refresh-token', tokenType: 'Basic' },
  ])('rejects an invalid success response', async (body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    )

    await expect(
      loginWithEmail({ email: 'member@example.com', password: 'Password123!' }),
    ).rejects.toMatchObject({ kind: 'unexpected_response' })
  })

  it('preserves the backend invalid-credentials code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 401,
            code: 'AUTH_003',
            message: '이메일 또는 비밀번호가 올바르지 않습니다.',
            path: '/api/v1/auth/login',
            errors: [],
          }),
          { status: 401 },
        ),
      ),
    )

    await expect(
      loginWithEmail({ email: 'member@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ kind: 'http', category: 'unauthorized', code: 'AUTH_003' })
  })
})

describe('logoutFromBackend', () => {
  it('posts with the current bearer token and accepts the backend 204 response', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(logoutFromBackend()).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/auth\/logout$/)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
    expect(init.body).toBeUndefined()
    expect(getAccessToken()).toBe(token)
  })

  it('does not attempt reissue when logout returns 401', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh-token')
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(logoutFromBackend()).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('reissues an expired access token before calling logout', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T00:00:00Z'))
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 1), 'refresh-token')
    vi.advanceTimersByTime(2_000)
    const nextToken = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/auth/reissue')
            ? new Response(JSON.stringify({ accessToken: nextToken, tokenType: 'Bearer' }))
            : new Response(null, { status: 204 }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(logoutFromBackend()).resolves.toBeUndefined()

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      '/api/v1/auth/reissue',
      '/api/v1/auth/logout',
    ])
    expect(
      new Headers((fetchMock.mock.calls[1][1] as RequestInit).headers).get('Authorization'),
    ).toBe(`Bearer ${nextToken}`)
  })
})
