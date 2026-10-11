import { describe, expect, it, vi } from 'vitest'
import { getReservations, type ReservationSearchRequest } from './reservationList'
import { reservationPage, reservationResult } from '../test/reservation'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('reservation list API contract', () => {
  it('uses the authenticated offset endpoint and projects only actual summary fields', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh')
    const mock = vi.fn().mockResolvedValue(Response.json(reservationPage()))
    vi.stubGlobal('fetch', mock)
    const result = await getReservations()
    const [url, init] = mock.mock.calls[0]
    const request = new URL(url, 'http://localhost')
    expect(request.pathname).toBe('/api/v1/reservations')
    expect(Object.fromEntries(request.searchParams)).toEqual({
      page: '0',
      size: '20',
      sortBy: 'ID',
      direction: 'DESC',
    })
    expect(init.method).toBe('GET')
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
    expect(result.content[0]).toMatchObject({ reservationId: 42, totalAmount: 350.25 })
    expect(result.content[0]).not.toHaveProperty('representativeGuest')
    expect(result.content[0]).not.toHaveProperty('memberId')
    expect(result.content[0]).not.toHaveProperty('createdAt')
  })
  it('sends supported inclusive date/status/sort filters and page metadata', async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          reservationPage({ page: 1, size: 1, first: false, totalElements: 2, totalPages: 2 }),
        ),
      )
    vi.stubGlobal('fetch', mock)
    await getReservations({
      page: 1,
      size: 1,
      status: 'CONFIRMED',
      checkInFrom: '2030-01-01',
      checkInTo: '2030-12-31',
      checkOutFrom: '2030-01-01',
      checkOutTo: '2031-01-01',
      sortBy: 'CHECK_IN_DATE',
      direction: 'ASC',
    })
    const query = new URL(mock.mock.calls[0][0], 'http://localhost').searchParams
    expect(query.get('checkInFrom')).toBe('2030-01-01')
    expect(query.get('checkInTo')).toBe('2030-12-31')
    expect(query.get('checkOutFrom')).toBe('2030-01-01')
    expect(query.get('checkOutTo')).toBe('2031-01-01')
    expect(query.get('status')).toBe('CONFIRMED')
    expect(query.get('sortBy')).toBe('CHECK_IN_DATE')
    expect(query.has('memberId')).toBe(false)
  })
  it.each([
    { page: -1 },
    { page: 2147483648 },
    { page: 0.5 },
    { size: 0 },
    { size: 101 },
    { checkInFrom: '2030-02-30' },
    { checkInFrom: '2030-01-02', checkInTo: '2030-01-01' },
    { checkOutFrom: '2030-01-02', checkOutTo: '2030-01-01' },
    { sortBy: 'memberId' },
    { status: 'PENDING' },
    { direction: 'INVALID' },
  ])('rejects an invalid query without fetch %j', async (request) => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await expect(getReservations(request as ReservationSearchRequest)).rejects.toBeInstanceOf(
      RangeError,
    )
    expect(mock).not.toHaveBeenCalled()
  })
  it.each([
    undefined,
    {},
    reservationPage({ page: 1 }),
    reservationPage({ size: 0 }),
    reservationPage({ totalElements: -1 }),
    reservationPage({ totalPages: 1.5 }),
    reservationPage({ first: false }),
    reservationPage({ last: false }),
    reservationPage({ content: [reservationResult, reservationResult] }),
    reservationPage({ content: [{ ...reservationResult, totalAmount: -1 }] }),
    reservationPage({ content: [{ ...reservationResult, checkInDate: undefined } as never] }),
    reservationPage({ content: [{ ...reservationResult, status: 'PENDING' } as never] }),
  ])('rejects malformed page or reservation data %j', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value ?? null)))
    await expect(getReservations()).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it('accepts empty lists and legacy/cancelled reservations without inventing data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json(
            reservationPage({
              content: [],
              totalElements: 0,
              totalPages: 0,
            }),
          ),
        )
        .mockResolvedValueOnce(
          Response.json(
            reservationPage({
              content: [
                {
                  ...reservationResult,
                  reservationNumber: null,
                  representativeGuest: null,
                  status: 'CANCELLED',
                },
              ],
            }),
          ),
        ),
    )
    await expect(getReservations()).resolves.toMatchObject({ content: [], totalPages: 0 })
    await expect(getReservations()).resolves.toMatchObject({
      content: [{ status: 'CANCELLED', reservationNumber: null }],
    })
  })
  it.each([400, 401, 403, 404, 409, 500])('preserves HTTP %i errors', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ status, code: 'TEST', message: 'server error', errors: [] }, { status }),
        ),
    )
    await expect(getReservations()).rejects.toMatchObject({ status, code: 'TEST' })
  })
  it('preserves network errors and forwards cancellation', async () => {
    const mock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', mock)
    await expect(getReservations()).rejects.toMatchObject({ kind: 'network' })
    const controller = new AbortController()
    controller.abort()
    await expect(getReservations({}, controller.signal)).rejects.toMatchObject({
      kind: 'cancelled',
    })
  })
  it('refreshes a rejected Access Token once and replays only GET', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    const renewed = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 120)
    setTokenPair(token, 'refresh')
    const mock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: renewed, tokenType: 'Bearer' }))
      .mockResolvedValueOnce(Response.json(reservationPage()))
    vi.stubGlobal('fetch', mock)
    await expect(getReservations()).resolves.toMatchObject({ content: [{ reservationId: 42 }] })
    expect(mock.mock.calls.map(([, init]) => init.method)).toEqual(['GET', 'POST', 'GET'])
    expect(new Headers(mock.mock.calls[2][1].headers).get('Authorization')).toBe(
      `Bearer ${renewed}`,
    )
  })
})
