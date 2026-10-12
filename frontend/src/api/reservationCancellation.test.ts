import { describe, expect, it, vi } from 'vitest'
import { cancelReservation } from './reservationCancellation'
import { cancellationResponse } from '../test/reservation'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('cancel API contract', () => {
  it('sends owner-authenticated PATCH with no body and validates the operation response', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh')
    const fetch = vi.fn().mockResolvedValue(Response.json(cancellationResponse))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    await expect(cancelReservation(42, controller.signal)).resolves.toEqual(cancellationResponse)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toMatch(/\/reservations\/42\/cancel$/)
    expect(init.method).toBe('PATCH')
    expect(init.body).toBeUndefined()
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('never refreshes or replays a 401 mutation', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    await expect(cancelReservation(42)).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([400, 403, 404, 409, 500, 503])(
    'preserves HTTP %i code and field errors',
    async (status) => {
      const fetch = vi.fn().mockResolvedValue(
        Response.json(
          {
            status,
            code: 'RESERVATION_009',
            message: '서버 거절',
            errors: [{ field: 'reservationId', message: '예약 확인' }],
          },
          { status },
        ),
      )
      vi.stubGlobal('fetch', fetch)
      await expect(cancelReservation(42)).rejects.toMatchObject({
        status,
        code: 'RESERVATION_009',
        fieldErrors: [{ field: 'reservationId', message: '예약 확인' }],
      })
      expect(fetch).toHaveBeenCalledOnce()
    },
  )
  it.each([
    null,
    {},
    { ...cancellationResponse, reservationId: 43 },
    { ...cancellationResponse, status: 'CONFIRMED' },
    { ...cancellationResponse, cancelledAt: null },
    { ...cancellationResponse, cancelledAt: '2029-02-30T00:00:00Z' },
    { ...cancellationResponse, cancelledAt: '2029-12-30T00:00:00+09:00' },
    { ...cancellationResponse, cancellationDate: '2029-02-30' },
    { ...cancellationResponse, daysBeforeCheckIn: -1 },
    { ...cancellationResponse, daysBeforeCheckIn: 1.5 },
    { ...cancellationResponse, cancellationFeeRate: 101 },
    { ...cancellationResponse, cancellationFeeRate: -1 },
    { ...cancellationResponse, cancellationFeeRate: 0.5 },
    { ...cancellationResponse, estimatedRefundAmount: undefined, refundAmount: 175.12 },
    { ...cancellationResponse, totalAmount: 350.26 },
    { ...cancellationResponse, cancellationFeeAmount: -1 },
    { ...cancellationResponse, estimatedRefundAmount: 175.123 },
  ])('rejects malformed or unrelated operation results %j', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)))
    await expect(cancelReservation(42)).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it.each([
    [0, 0, 350.25],
    [100, 350.25, 0],
  ] as const)('retains zero and full fee server results', async (rate, fee, refund) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ...cancellationResponse,
          cancellationFeeRate: rate,
          cancellationFeeAmount: fee,
          estimatedRefundAmount: refund,
        }),
      ),
    )
    await expect(cancelReservation(42)).resolves.toMatchObject({
      cancellationFeeAmount: fee,
      estimatedRefundAmount: refund,
    })
  })
  it.each([0, -1, 1.5, NaN])('rejects invalid ID %s before HTTP', async (id) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(cancelReservation(id)).rejects.toThrow(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
