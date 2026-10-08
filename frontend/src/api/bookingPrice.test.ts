import { describe, expect, it, vi } from 'vitest'
import { getBookingPrice, getEffectiveRoomPrice, stayDates } from './bookingPrice'
import { setAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

const price = {
  roomDailyPriceId: null,
  roomId: 3,
  stayDate: '2030-01-01',
  nightlyPrice: 0.1,
  source: 'DEFAULT',
}
describe('booking price API', () => {
  it('bounds date requests to four and aborts them when the caller cancels', async () => {
    const mock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    vi.stubGlobal('fetch', mock)
    const controller = new AbortController()
    const pending = getBookingPrice(3, '2030-01-01', '2030-01-10', controller.signal)
    const rejection = expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
    await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(4))
    controller.abort()
    await rejection
    expect(mock).toHaveBeenCalledTimes(4)
  })
  it('uses backend daily/default effective prices, excludes checkout and sums decimal values exactly', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setAccessToken(token)
    const mock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.endsWith('2030-01-01')
            ? price
            : {
                ...price,
                roomDailyPriceId: 8,
                stayDate: '2030-01-02',
                nightlyPrice: 0.2,
                source: 'DAILY',
              },
        ),
      ),
    )
    vi.stubGlobal('fetch', mock)
    const result = await getBookingPrice(3, '2030-01-01', '2030-01-03')
    expect(result.totalMinorUnits).toBe(30n)
    expect(result.nights.map((night) => night.source)).toEqual(['DEFAULT', 'DAILY'])
    expect(mock).toHaveBeenCalledTimes(2)
    expect(new Headers(mock.mock.calls[0][1].headers).get('Authorization')).toBeNull()
    expect(mock.mock.calls.some(([url]) => url.endsWith('2030-01-03'))).toBe(false)
  })
  it('handles leap day and year boundaries in UTC, not local DST offsets', () => {
    expect(stayDates('2032-02-28', '2032-03-01')).toEqual(['2032-02-28', '2032-02-29'])
    expect(stayDates('2030-12-31', '2031-01-02')).toEqual(['2030-12-31', '2031-01-01'])
    expect(() => stayDates('2030-01-01', '2030-01-01')).toThrow()
  })
  it.each([
    {},
    { ...price, roomId: 4 },
    { ...price, stayDate: '2030-01-02' },
    { ...price, nightlyPrice: -1 },
    { ...price, nightlyPrice: 0.001 },
    { ...price, source: 'UNKNOWN' },
    { ...price, roomDailyPriceId: 1 },
    { ...price, source: 'DAILY', nightlyPrice: 1 },
  ])('rejects invalid effective price contracts %j', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
    await expect(getEffectiveRoomPrice(3, '2030-01-01')).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })
  it('fails the whole quote if any stay-date request fails; never applies a client fallback', async () => {
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('2030-01-01')
            ? Response.json(price)
            : Response.json({ status: 500 }, { status: 500 }),
        ),
      )
    vi.stubGlobal('fetch', mock)
    await expect(getBookingPrice(3, '2030-01-01', '2030-01-03')).rejects.toMatchObject({
      status: 500,
    })
  })
})
