import { describe, expect, it, vi } from 'vitest'
import {
  getReservationDetail,
  readReservationDetail,
  type ReservationDetail,
} from './reservationDetail'
import { reservationDetail } from '../test/reservation'
import { accessTokenWithExpiry } from '../test/jwt'
import { setTokenPair } from '../state/accessToken'

describe('owner reservation detail contract', () => {
  it('uses one authenticated GET with cancellation and preserves the saved snapshots', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh')
    const signal = new AbortController().signal
    const mock = vi.fn().mockResolvedValue(Response.json(reservationDetail))
    vi.stubGlobal('fetch', mock)
    await expect(getReservationDetail(42, signal)).resolves.toEqual(reservationDetail)
    expect(mock).toHaveBeenCalledTimes(1)
    const [url, init] = mock.mock.calls[0]
    expect(url).toMatch(/\/reservations\/42$/)
    expect(init.method).toBe('GET')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
    await expect(getReservationDetail(41)).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it.each([0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid ID %s before requesting',
    async (id) => {
      const mock = vi.fn()
      vi.stubGlobal('fetch', mock)
      await expect(getReservationDetail(id)).rejects.toBeInstanceOf(RangeError)
      expect(mock).not.toHaveBeenCalled()
    },
  )
  it('accepts legacy missing history without inventing information', () => {
    const legacy: ReservationDetail = {
      ...reservationDetail,
      reservationNumber: null,
      representativeGuest: null,
      nights: [],
      status: 'CANCELLED',
    }
    expect(readReservationDetail(legacy)).toEqual(legacy)
  })
  it('accepts exact cancelled UTC data including nanoseconds and zero fees', () => {
    const cancelled: ReservationDetail = {
      ...reservationDetail,
      status: 'CANCELLED',
      cancelledAt: '2030-01-01T01:02:03.123456789Z',
      cancellationFeeAmount: 0,
      refundAmount: 350.25,
    }
    expect(readReservationDetail(cancelled)).toEqual(cancelled)
  })
  it('accepts unsorted night history without changing it or using current prices', () => {
    const value = { ...reservationDetail, nights: [...reservationDetail.nights].reverse() }
    expect(readReservationDetail(value)).toEqual(value)
  })
  it.each([
    { nightlyPriceSnapshot: undefined },
    { nightlyPriceSnapshot: -1 },
    { nightlyPriceSnapshot: 100.123 },
    { stayNights: 3 },
    { nights: undefined },
    { nights: [reservationDetail.nights[0]] },
    { nights: [reservationDetail.nights[0], reservationDetail.nights[0]] },
    { nights: [reservationDetail.nights[0], { stayDate: '2030-01-03', priceSnapshot: 250.15 }] },
    { nights: [reservationDetail.nights[0], { stayDate: '2030-02-30', priceSnapshot: 250.15 }] },
    { nights: [reservationDetail.nights[0], { stayDate: '2030-01-02', priceSnapshot: -1 }] },
    { totalAmount: 350.26 },
    { nightlyPriceSnapshot: 100.2 },
    { cancellationPolicySnapshot: null },
    {
      cancellationPolicySnapshot: { ...reservationDetail.cancellationPolicySnapshot, feeRules: [] },
    },
    {
      cancellationPolicySnapshot: {
        ...reservationDetail.cancellationPolicySnapshot,
        freeCancellationDaysBeforeCheckIn: 1,
      },
    },
    {
      cancellationPolicySnapshot: {
        ...reservationDetail.cancellationPolicySnapshot,
        cancellationDeadlineDaysBeforeCheckIn: -1,
      },
    },
    {
      cancellationPolicySnapshot: {
        ...reservationDetail.cancellationPolicySnapshot,
        feeRules: [
          { minDaysBeforeCheckIn: 3, feeRatePercent: 101 },
          { minDaysBeforeCheckIn: 1, feeRatePercent: 50 },
        ],
      },
    },
    {
      cancellationPolicySnapshot: {
        ...reservationDetail.cancellationPolicySnapshot,
        feeRules: [{ minDaysBeforeCheckIn: 3, feeRatePercent: 30 }],
      },
    },
    {
      cancellationPolicySnapshot: {
        ...reservationDetail.cancellationPolicySnapshot,
        feeRules: [...reservationDetail.cancellationPolicySnapshot.feeRules].reverse(),
      },
    },
    { cancellationFeeAmount: undefined },
    { status: 'CANCELLED', cancellationFeeAmount: -1 },
    { status: 'CANCELLED', refundAmount: 1e17 },
    { status: 'CANCELLED', cancelledAt: '2030-02-30T00:00:00Z' },
    { status: 'CANCELLED', cancelledAt: '2030-01-01T00:00:00+09:00' },
    { status: 'CANCELLED', cancelledAt: '2030-01-01T25:00:00Z' },
    { cancelledAt: '2030-01-01T00:00:00Z' },
  ])('rejects invalid or contradictory detail fields %j', (override) => {
    expect(() =>
      readReservationDetail({ ...reservationDetail, ...override } as ReservationDetail),
    ).toThrow()
  })
})
