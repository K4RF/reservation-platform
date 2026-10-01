import { afterEach, describe, expect, it } from 'vitest'
import { consumeGoogleCallback, createGoogleLoginStartUrl } from './googleOAuth2'

afterEach(() => sessionStorage.clear())

describe('Google OAuth2 browser handoff', () => {
  it('creates a random-looking state and consumes a matching one-time callback', () => {
    const url = new URL(
      createGoogleLoginStartUrl(
        'http://localhost:8080',
        sessionStorage,
        new Uint8Array(24).fill(7),
      ),
    )
    const state = url.searchParams.get('state')
    const code = 'a'.repeat(43)

    expect(url.origin).toBe('http://localhost:8080')
    expect(url.pathname).toBe('/api/v1/auth/oauth2/google/start')
    expect(state).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(consumeGoogleCallback(`#code=${code}&state=${state}`)).toEqual({ type: 'code', code })
    expect(consumeGoogleCallback(`#code=${code}&state=${state}`)).toEqual({ type: 'invalid' })
    expect(sessionStorage.length).toBe(0)
  })

  it('rejects a mismatched state and distinguishes cancellation from failure', () => {
    const state = new URL(
      createGoogleLoginStartUrl(
        'http://localhost:8080',
        sessionStorage,
        new Uint8Array(24).fill(8),
      ),
    ).searchParams.get('state')
    expect(consumeGoogleCallback(`#code=${'a'.repeat(43)}&state=attacker`)).toEqual({
      type: 'invalid',
    })

    createGoogleLoginStartUrl('http://localhost:8080', sessionStorage, new Uint8Array(24).fill(8))
    expect(consumeGoogleCallback(`#error=cancelled&state=${state}`)).toEqual({ type: 'cancelled' })

    createGoogleLoginStartUrl('http://localhost:8080', sessionStorage, new Uint8Array(24).fill(8))
    expect(consumeGoogleCallback(`#error=failed&state=${state}`)).toEqual({ type: 'failed' })
  })

  it('rejects malformed backend origins before storing state', () => {
    expect(() => createGoogleLoginStartUrl('javascript:alert(1)')).toThrow()
    expect(sessionStorage.length).toBe(0)
  })
})
