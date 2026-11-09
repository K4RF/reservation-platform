import { describe, expect, it, vi } from 'vitest'
import { getLocationSuggestions, normalizeLocationQuery } from './locationSuggestions'
import { accessTokenWithExpiry } from '../test/jwt'
import { setAccessToken } from '../state/accessToken'
import { gangnam, seoul } from '../test/locationSuggestions'

describe('public location suggestions', () => {
  it('encodes q and sends no credentials even for a signed-in user', async () => {
    setAccessToken(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))
    const fetch = vi.fn().mockResolvedValue(Response.json([seoul, gangnam]))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    await expect(getLocationSuggestions('서울 & 강남', controller.signal)).resolves.toEqual([
      seoul,
      gangnam,
    ])
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url, 'http://localhost')
    expect(parsed.pathname).toBe('/api/v1/accommodations/locations/suggestions')
    expect(parsed.searchParams.get('q')).toBe('서울 & 강남')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })

  it.each([
    {},
    [null],
    [{ ...gangnam, displayName: 'Wrong name' }],
    [{ ...seoul, searchParams: gangnam.searchParams }],
    [{ ...gangnam, searchParams: { ...gangnam.searchParams, region: '' } }],
    [{ ...seoul, searchParams: { ...seoul.searchParams, status: 'INACTIVE' } }],
    Array.from({ length: 11 }, () => seoul),
  ])('rejects malformed successful responses: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
    await expect(
      getLocationSuggestions('서울', new AbortController().signal),
    ).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })

  it('matches the Backend length and Unicode whitespace rules', () => {
    expect(normalizeLocationQuery(' \u00a0서울\t   강남 ')).toBe('서울 강남')
    expect(normalizeLocationQuery('  🗺  ')).toBeNull()
    expect(normalizeLocationQuery('서')).toBeNull()
    expect(normalizeLocationQuery('서'.repeat(100))).toHaveLength(100)
    expect(normalizeLocationQuery('서'.repeat(101))).toBeNull()
  })
})
