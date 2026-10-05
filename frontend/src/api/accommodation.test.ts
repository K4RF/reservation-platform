import { describe, expect, it, vi } from 'vitest'
import { getAccommodation, searchAccommodations } from './accommodation'
import { setAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'
import { accommodationPage } from '../test/accommodation'

describe('searchAccommodations', () => {
  it('serializes the real query contract, repeated amenities and false/zero with Bearer auth', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setAccessToken(token)
    const fetchMock = vi.fn().mockResolvedValue(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', fetchMock)
    await searchAccommodations({
      name: '서울 & 호텔',
      city: '서울특별시',
      region: '',
      accommodationAmenities: ['PARKING', 'POOL'],
      roomAmenities: ['WIFI'],
      checkInDate: '2030-01-01',
      checkOutDate: '2030-01-02',
      available: false,
      guestCount: 2,
      minPrice: '0',
      maxPrice: '200000.50',
      status: 'ACTIVE',
      page: 0,
      size: 20,
      sortBy: 'NAME',
      direction: 'ASC',
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const query = new URL(url, 'http://localhost').searchParams
    expect(query.get('name')).toBe('서울 & 호텔')
    expect(query.getAll('accommodationAmenities')).toEqual(['PARKING', 'POOL'])
    expect(query.get('available')).toBe('false')
    expect(query.get('page')).toBe('0')
    expect(query.get('minPrice')).toBe('0')
    expect(query.has('region')).toBe(false)
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
  })

  it('accepts legacy null locations and times without guessing values', async () => {
    const page = accommodationPage()
    Object.assign((page.content[0] = { ...page.content[0] }), {
      country: null,
      city: null,
      region: null,
      checkInTime: null,
      checkOutTime: null,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(page)))
    await expect(searchAccommodations()).resolves.toEqual(page)
  })

  it.each([
    {},
    { content: [null] },
    accommodationPage({ totalPages: -1 }),
    accommodationPage({
      content: [{ ...accommodationPage().content[0], status: 'UNKNOWN' } as never],
    }),
    accommodationPage({
      content: [{ ...accommodationPage().content[0], amenities: ['UNKNOWN'] } as never],
    }),
  ])('rejects malformed successful responses: %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
    await expect(searchAccommodations()).rejects.toMatchObject({ kind: 'unexpected_response' })
  })

  it('propagates backend validation errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { status: 400, code: 'COMMON_001', message: 'invalid', errors: [] },
            { status: 400 },
          ),
        ),
    )
    await expect(searchAccommodations()).rejects.toMatchObject({
      category: 'bad_request',
      code: 'COMMON_001',
    })
  })
})

describe('getAccommodation', () => {
  it('uses the real detail path and validates the returned identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(accommodationPage().content[0]))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getAccommodation(7)).resolves.toEqual(accommodationPage().content[0])
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/accommodations\/7$/)
  })
  it('rejects a mismatched detail response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(accommodationPage().content[0])))
    await expect(getAccommodation(8)).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
})
