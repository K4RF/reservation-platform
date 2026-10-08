import { describe, expect, it, vi } from 'vitest'
import { createReservation, getReservation } from './reservation'
import { bookingRequest, reservationResult } from '../test/reservation'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('reservation API contract', () => {
  it('posts only the booking request with Bearer auth and returns the real number/ID', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh')
    const mock = vi.fn().mockResolvedValue(Response.json(reservationResult, { status: 201 }))
    vi.stubGlobal('fetch', mock)
    await expect(createReservation(bookingRequest)).resolves.toEqual(reservationResult)
    const [url, init] = mock.mock.calls[0]
    expect(url).toMatch(/\/api\/v1\/reservations$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual(bookingRequest)
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
  })
  it('never refreshes and replays a POST after a 401', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = vi.fn().mockResolvedValue(Response.json({}, { status: 401 }))
    vi.stubGlobal('fetch', mock)
    await expect(createReservation(bookingRequest)).rejects.toMatchObject({ status: 401 })
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it.each([400, 403, 404, 409, 500, 503])(
    'propagates HTTP %i without automatic replay',
    async (status) => {
      const mock = vi.fn().mockResolvedValue(
        Response.json(
          {
            status,
            code: 'TEST',
            message: 'failed',
            errors: [{ field: 'representativeGuest.name', message: '필수' }],
          },
          { status },
        ),
      )
      vi.stubGlobal('fetch', mock)
      await expect(createReservation(bookingRequest)).rejects.toMatchObject({
        status,
        code: 'TEST',
        fieldErrors: [{ field: 'representativeGuest.name', message: '필수' }],
      })
      expect(mock).toHaveBeenCalledTimes(1)
    },
  )
  it.each([
    { ...reservationResult, roomId: 9 },
    { ...reservationResult, reservationNumber: null },
    { ...reservationResult, representativeGuest: null },
    { ...reservationResult, status: 'CANCELLED' },
    { ...reservationResult, totalAmount: -1 },
  ])('rejects an invalid or unrelated creation result %j', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)))
    await expect(createReservation(bookingRequest)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })
  it('uses GET for owner result recovery and rejects wrong IDs', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(reservationResult))
    vi.stubGlobal('fetch', mock)
    await expect(getReservation(42)).resolves.toEqual(reservationResult)
    expect(mock.mock.calls[0][0]).toMatch(/\/reservations\/42$/)
    expect(mock.mock.calls[0][1].method).toBe('GET')
    await expect(getReservation(41)).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it('supports total DECIMAL(19,2) values beyond nightly DECIMAL(12,2) without rounding unsafe numbers', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ ...reservationResult, totalAmount: 10000000000.25 })),
    )
    await expect(getReservation(42)).resolves.toMatchObject({ totalAmount: 10000000000.25 })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...reservationResult, totalAmount: 1e17 })),
    )
    await expect(getReservation(42)).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
})
