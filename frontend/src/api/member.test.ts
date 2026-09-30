import { describe, expect, it, vi } from 'vitest'
import { signUpMember } from './member'
import { setAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('signUpMember', () => {
  it('posts only the backend signup fields and returns the created member', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ memberId: 7, email: 'member@example.com', role: 'USER' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))

    await expect(
      signUpMember({ email: 'member@example.com', password: 'Password123!' }),
    ).resolves.toEqual({ memberId: 7, email: 'member@example.com', role: 'USER' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/api\/v1\/members$/)
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(init.body).toBe(
      JSON.stringify({ email: 'member@example.com', password: 'Password123!' }),
    )
  })

  it('rejects an empty success body instead of claiming signup succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(
      signUpMember({ email: 'member@example.com', password: 'Password123!' }),
    ).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
})
