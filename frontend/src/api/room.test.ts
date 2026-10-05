import { describe, expect, it, vi } from 'vitest'
import { getAccommodationRooms, getAvailableRooms } from './room'
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

describe('getAvailableRooms', () => {
  const request = { checkInDate: '2030-01-01', checkOutDate: '2030-01-03', guestCount: 2 }
  it('sends ISO dates, guests and pagination with Bearer auth to the dedicated endpoint', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setAccessToken(token)
    const mock = vi.fn().mockResolvedValue(Response.json(roomPage()))
    vi.stubGlobal('fetch', mock)
    await getAvailableRooms(7, request)
    const [url, init] = mock.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/accommodations\/7\/rooms\/available\?/)
    const params = new URL(url, 'http://localhost').searchParams
    expect(Object.fromEntries(params)).toEqual({
      ...request,
      guestCount: '2',
      page: '0',
      size: '20',
    })
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
  })
  it('rejects invalid dates before making a request', async () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await expect(
      getAvailableRooms(7, { ...request, checkOutDate: request.checkInDate }),
    ).rejects.toBeInstanceOf(RangeError)
    expect(mock).not.toHaveBeenCalled()
  })
  it.each([
    { ...room, status: 'INACTIVE' as const },
    { ...room, capacity: 1 },
  ])('fails closed on inconsistent available-room responses %j', async (row) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(roomPage({ content: [row] }))))
    await expect(getAvailableRooms(7, request)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })
  it('propagates backend policy errors instead of treating failure as empty availability', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { status: 400, code: 'BOOKING_POLICY_003', message: 'not allowed' },
            { status: 400 },
          ),
        ),
    )
    await expect(getAvailableRooms(7, request)).rejects.toMatchObject({ category: 'bad_request' })
  })
})
