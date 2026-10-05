import { describe, expect, it, vi } from 'vitest'
import { getAccommodationRooms } from './room'
import { room, roomPage } from '../test/room'
import { setAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('getAccommodationRooms', () => {
  it('uses the accommodation-scoped paginated endpoint and Bearer client', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setAccessToken(token)
    const fetchMock = vi.fn().mockResolvedValue(Response.json(roomPage({ page: 1 })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getAccommodationRooms(7, 1)).resolves.toMatchObject({ page: 1 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/accommodations\/7\/rooms\?page=1&size=20&sortBy=ID&direction=ASC$/)
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
  })
  it.each([
    {},
    roomPage({ content: [null as never] }),
    roomPage({ content: [{ ...room, capacity: 0 }] }),
    roomPage({ content: [{ ...room, accommodationId: 8 }] }),
    roomPage({ content: [{ ...room, nightlyPrice: -1 }] }),
    roomPage({ content: [{ ...room, amenities: ['POOL'] as never }] }),
    roomPage({ page: 1 }),
  ])('rejects malformed or wrong-resource responses %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
    await expect(getAccommodationRooms(7)).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
})
