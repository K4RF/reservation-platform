import { describe, expect, it, vi } from 'vitest'
import {
  saveAccommodation,
  changeAccommodationStatus,
  saveBookingPolicy,
  saveCancellationPolicy,
  validBookingPolicy,
  validCancellationPolicy,
} from './adminAccommodation'
import { accommodation } from '../test/accommodation'
import { accessTokenWithExpiry } from '../test/jwt'
import { setTokenPair } from '../state/accessToken'
import {
  accommodationWrite,
  bookingPolicy as booking,
  cancellationPolicy as cancellation,
} from '../test/adminAccommodation'

describe('Accommodation Admin wire contracts', () => {
  it.each([null, 7])(
    'sends only actual Create/Update fields for %s with Bearer authentication',
    async (id) => {
      const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN')
      setTokenPair(token, 'refresh')
      const fetch = vi.fn().mockResolvedValue(Response.json(accommodation))
      vi.stubGlobal('fetch', fetch)
      await expect(saveAccommodation(id, accommodationWrite)).resolves.toEqual(accommodation)
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
      expect(url).toMatch(id === null ? /\/accommodations$/ : /\/accommodations\/7$/)
      expect(init.method).toBe(id === null ? 'POST' : 'PUT')
      expect(JSON.parse(init.body as string)).toEqual(accommodationWrite)
      expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
      expect(JSON.parse(init.body as string)).not.toHaveProperty('status')
    },
  )
  it('uses status PATCH, not DELETE or the full update body', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ...accommodation, status: 'INACTIVE' }))
    vi.stubGlobal('fetch', fetch)
    await changeAccommodationStatus(7, 'INACTIVE')
    expect(fetch.mock.calls[0][0]).toMatch(/\/accommodations\/7\/status$/)
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'INACTIVE' }),
    })
  })
  it.each(['POST', 'PUT'] as const)(
    'keeps separate explicit %s policy operations and validates success IDs',
    async (operation) => {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ ...booking, bookingPolicyId: 12, accommodationId: 7 }),
        )
        .mockResolvedValueOnce(
          Response.json({ ...cancellation, cancellationPolicyId: 13, accommodationId: 7 }),
        )
      vi.stubGlobal('fetch', fetch)
      await expect(saveBookingPolicy(7, operation, booking)).resolves.toMatchObject({
        bookingPolicyId: 12,
      })
      await expect(saveCancellationPolicy(7, operation, cancellation)).resolves.toMatchObject({
        cancellationPolicyId: 13,
      })
      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        expect.stringMatching(/\/7\/booking-policy$/),
        expect.stringMatching(/\/7\/cancellation-policy$/),
      ])
      expect(fetch.mock.calls.map(([, init]) => init.method)).toEqual([operation, operation])
    },
  )
  it.each([400, 401, 403, 404, 409, 500])(
    'preserves common HTTP %s errors and never replays writes',
    async (status) => {
      setTokenPair(
        accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN'),
        'refresh',
      )
      const fetch = vi.fn().mockResolvedValue(
        Response.json(
          {
            status,
            code: 'SERVER_CODE',
            message: '서버 오류',
            errors: [{ field: 'name', message: '입력 오류' }],
            path: '/api/v1/accommodations',
          },
          { status },
        ),
      )
      vi.stubGlobal('fetch', fetch)
      await expect(saveAccommodation(null, accommodationWrite)).rejects.toMatchObject({
        status,
        code: 'SERVER_CODE',
        fieldErrors: [{ field: 'name', message: '입력 오류' }],
      })
      expect(fetch).toHaveBeenCalledOnce()
    },
  )
  it.each([
    () => saveAccommodation(null, accommodationWrite),
    () => saveAccommodation(7, accommodationWrite),
    () => changeAccommodationStatus(7, 'INACTIVE'),
    () => saveBookingPolicy(7, 'POST', booking),
    () => saveBookingPolicy(7, 'PUT', booking),
    () => saveCancellationPolicy(7, 'POST', cancellation),
    () => saveCancellationPolicy(7, 'PUT', cancellation),
  ])('never reissues or replays any Admin write after 401', async (call) => {
    setTokenPair(
      accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN'),
      'refresh',
    )
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: 401, code: 'AUTH_001', message: '인증 필요' }, { status: 401 }),
      )
    vi.stubGlobal('fetch', fetch)
    await expect(call()).rejects.toMatchObject({ status: 401 })
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([
    () => saveAccommodation(8, accommodationWrite),
    () => changeAccommodationStatus(7, 'INACTIVE'),
    () => saveBookingPolicy(7, 'POST', booking),
    () => saveCancellationPolicy(7, 'PUT', cancellation),
  ])('rejects malformed or mismatched success instead of claiming saved', async (call) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(accommodation)))
    await expect(call()).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it('rejects wrong policy identity and invalid policy fields', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ...booking, bookingPolicyId: 1, accommodationId: 8 }))
      .mockResolvedValueOnce(
        Response.json({
          ...cancellation,
          cancellationPolicyId: 1,
          accommodationId: 7,
          feeRules: [{ minDaysBeforeCheckIn: 3, feeRatePercent: 120 }],
        }),
      )
    vi.stubGlobal('fetch', fetch)
    await expect(saveBookingPolicy(7, 'POST', booking)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
    await expect(saveCancellationPolicy(7, 'PUT', cancellation)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })
  it('mirrors booking and cancellation range constraints without requiring rates to increase', () => {
    expect(validBookingPolicy(booking)).toBe(true)
    expect(validBookingPolicy({ ...booking, maxStayNights: 0 })).toBe(false)
    expect(validBookingPolicy({ ...booking, minAdvanceBookingDays: 1.2 })).toBe(false)
    expect(validCancellationPolicy(cancellation)).toBe(true)
    expect(
      validCancellationPolicy({ ...cancellation, feeRules: [...cancellation.feeRules].reverse() }),
    ).toBe(true)
    for (const feeRules of [
      [],
      [{ minDaysBeforeCheckIn: 3, feeRatePercent: 30 }],
      [...cancellation.feeRules, cancellation.feeRules[0]],
      [{ minDaysBeforeCheckIn: 7, feeRatePercent: 30 }],
    ]) {
      expect(validCancellationPolicy({ ...cancellation, feeRules })).toBe(false)
    }
  })
})
