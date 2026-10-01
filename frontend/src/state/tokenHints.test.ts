import { describe, expect, it } from 'vitest'
import { readAccessTokenHints } from './tokenHints'
import { accessTokenWithExpiry } from '../test/jwt'

describe('unverified token hints', () => {
  it('reads expiry and recognized role from one validated payload', () => {
    expect(readAccessTokenHints(accessTokenWithExpiry(200, 'ACCESS', 'ADMIN'), 100_000)).toEqual({
      expiresAt: 200_000,
      role: 'ADMIN',
    })
  })
  it.each([
    'bad',
    'a.!.b',
    'a.bnVsbA.b',
    'a.W10.b',
    accessTokenWithExpiry(100),
    accessTokenWithExpiry(200, 'REFRESH'),
  ])('rejects malformed, expired or non-access input %s', (token) => {
    expect(readAccessTokenHints(token, 100_000)).toBeNull()
  })
  it('keeps an unknown role null without inventing a profile', () => {
    expect(
      readAccessTokenHints(accessTokenWithExpiry(200, 'ACCESS', 'ROOT'), 100_000)?.role,
    ).toBeNull()
  })
  it('decodes UTF-8 claims without breaking the role hint', () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ token_type: 'ACCESS', exp: 200, role: 'USER', name: '회원' }),
    )
    const token = `header.${btoa(String.fromCharCode(...bytes))}.signature`
    expect(readAccessTokenHints(token, 100_000)).toEqual({ expiresAt: 200_000, role: 'USER' })
  })
})
