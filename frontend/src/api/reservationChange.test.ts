import { describe, expect, it, vi } from 'vitest'
import { changeReservationSchedule } from './reservationChange'
import { reservationDetail, changedReservationDetail } from '../test/reservation'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

const request = { checkInDate: '2030-01-02', checkOutDate: '2030-01-04' }

describe('reservation schedule change API', () => {
  it('sends authenticated PATCH with dates only and reads the complete authoritative snapshot', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh')
    const mock = vi.fn().mockResolvedValue(Response.json(changedReservationDetail))
    vi.stubGlobal('fetch', mock)
    const result = await changeReservationSchedule(reservationDetail, {
      ...request,
      roomId: 99,
    } as typeof request)
    expect(result).toEqual(changedReservationDetail)
    expect(reservationDetail.totalAmount).toBe(350.25)
    const [url, init] = mock.mock.calls[0]
    expect(url).toMatch(/\/reservations\/42$/)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual(request)
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
  })
  it('never refreshes/replays a rejected PATCH on 401', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = vi.fn().mockResolvedValue(Response.json({}, { status: 401 }))
    vi.stubGlobal('fetch', mock)
    await expect(changeReservationSchedule(reservationDetail, request)).rejects.toMatchObject({
      status: 401,
    })
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it.each([400, 403, 404, 409, 500, 503])(
    'preserves HTTP %i and field errors without replay',
    async (status) => {
      const mock = vi.fn().mockResolvedValue(
        Response.json(
          {
            status,
            code: 'TEST',
            message: '거절',
            errors: [{ field: 'checkInDate', message: '날짜 오류' }],
          },
          { status },
        ),
      )
      vi.stubGlobal('fetch', mock)
      await expect(changeReservationSchedule(reservationDetail, request)).rejects.toMatchObject({
        status,
        code: 'TEST',
        fieldErrors: [{ field: 'checkInDate', message: '날짜 오류' }],
      })
      expect(mock).toHaveBeenCalledTimes(1)
    },
  )
  it.each([
    { ...changedReservationDetail, reservationId: 43 },
    { ...changedReservationDetail, roomId: 4 },
    { ...changedReservationDetail, guestCount: 3 },
    { ...changedReservationDetail, reservationNumber: null },
    { ...changedReservationDetail, representativeGuest: null },
    {
      ...changedReservationDetail,
      cancellationPolicySnapshot: {
        ...reservationDetail.cancellationPolicySnapshot,
        freeCancellationDaysBeforeCheckIn: 8,
      },
    },
    { ...changedReservationDetail, nights: [] },
    { ...changedReservationDetail, totalAmount: 1 },
    reservationDetail,
  ])('rejects unrelated, incomplete or changed immutable fields %j', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)))
    await expect(changeReservationSchedule(reservationDetail, request)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })
  it('compares immutable values independently of JSON field order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ...changedReservationDetail,
          representativeGuest: {
            phone: reservationDetail.representativeGuest!.phone,
            email: reservationDetail.representativeGuest!.email,
            name: reservationDetail.representativeGuest!.name,
          },
        }),
      ),
    )
    await expect(changeReservationSchedule(reservationDetail, request)).resolves.toBeDefined()
  })
  it.each([
    { checkInDate: '', checkOutDate: '2030-01-04' },
    { checkInDate: '2030-01-04', checkOutDate: '2030-01-04' },
    { checkInDate: '2030-02-30', checkOutDate: '2030-03-03' },
  ])('validates dates before transport %j', async (value) => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await expect(changeReservationSchedule(reservationDetail, value)).rejects.toThrow(RangeError)
    expect(mock).not.toHaveBeenCalled()
  })
})
