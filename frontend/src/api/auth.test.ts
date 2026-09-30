import { describe, expect, it, vi } from 'vitest'
import { loginWithEmail } from './auth'

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

    await expect(
      loginWithEmail({ email: 'member@example.com', password: 'Password123!' }),
    ).resolves.toEqual(tokens)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/auth\/login$/)
    expect(init.method).toBe('POST')
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
