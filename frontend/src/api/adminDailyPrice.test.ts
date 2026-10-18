import { describe, expect, it, vi } from 'vitest'
import { createRoomDailyPrice, updateRoomDailyPrice } from './adminDailyPrice'
import { dailyPrice, defaultPrice } from '../test/dailyPrice'
import { accessTokenWithExpiry } from '../test/jwt'
import { setTokenPair } from '../state/accessToken'

function authenticate() {
  const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN')
  setTokenPair(token, 'refresh')
  return token
}
const calls = [
  () =>
    createRoomDailyPrice(3, {
      stayDate: dailyPrice.stayDate,
      nightlyPrice: dailyPrice.nightlyPrice,
    }),
  () => updateRoomDailyPrice(3, dailyPrice.stayDate, { nightlyPrice: dailyPrice.nightlyPrice }),
]
describe('Daily Price Admin write contract', () => {
  it.each(['POST', 'PUT'])('sends the exact %s URL/body with Bearer auth', async (method) => {
    const token = authenticate(),
      fetch = vi
        .fn()
        .mockResolvedValue(Response.json(dailyPrice, { status: method === 'POST' ? 201 : 200 }))
    vi.stubGlobal('fetch', fetch)
    await expect(calls[method === 'POST' ? 0 : 1]()).resolves.toEqual(dailyPrice)
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(
      method === 'POST' ? /\/rooms\/3\/prices$/ : /\/rooms\/3\/prices\/2030-07-20$/,
    )
    expect(init.method).toBe(method)
    expect(JSON.parse(init.body as string)).toEqual(
      method === 'POST'
        ? { stayDate: '2030-07-20', nightlyPrice: 180000.5 }
        : { nightlyPrice: 180000.5 },
    )
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(calls)('does not refresh or replay a write rejected with 401', async (call) => {
    authenticate()
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: 401, code: 'AUTH_001', message: '인증 필요' }, { status: 401 }),
      )
    vi.stubGlobal('fetch', fetch)
    await expect(call()).rejects.toMatchObject({ status: 401, code: 'AUTH_001' })
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([400, 403, 404, 409, 500])(
    'preserves common HTTP %s/field errors and never changes operation',
    async (status) => {
      const fetch = vi.fn().mockResolvedValue(
        Response.json(
          {
            status,
            code: 'ROOM_PRICE_ERROR',
            message: '가격 요청 거절',
            errors: [{ field: 'nightlyPrice', message: '가격 확인' }],
            path: '/api/v1/rooms/3/prices',
          },
          { status },
        ),
      )
      vi.stubGlobal('fetch', fetch)
      await expect(calls[0]()).rejects.toMatchObject({
        status,
        code: 'ROOM_PRICE_ERROR',
        fieldErrors: [{ field: 'nightlyPrice', message: '가격 확인' }],
      })
      expect(fetch).toHaveBeenCalledOnce()
    },
  )
  it.each([
    {},
    defaultPrice,
    { ...dailyPrice, roomId: 4 },
    { ...dailyPrice, stayDate: '2030-07-21' },
    { ...dailyPrice, roomDailyPriceId: null },
    { ...dailyPrice, nightlyPrice: 0 },
    { ...dailyPrice, nightlyPrice: 0.001 },
  ])('rejects a wrong identity/source/amount success %j', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))
    await expect(calls[0]()).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it('validates PUT success too, rather than assuming a nonempty response is saved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...dailyPrice, stayDate: '2030-07-21' })),
    )
    await expect(calls[1]()).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it.each([
    ['0', '2030-07-20'],
    ['3', '2030-02-30'],
    ['3', '2030-07-20/other'],
    ['9007199254740992', '2030-07-20'],
  ])('rejects invalid target %s/%s before a write', async (id, stayDate) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(
      createRoomDailyPrice(Number(id), { stayDate, nightlyPrice: 100 }),
    ).rejects.toBeInstanceOf(RangeError)
    await expect(
      updateRoomDailyPrice(Number(id), stayDate, { nightlyPrice: 100 }),
    ).rejects.toBeInstanceOf(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
