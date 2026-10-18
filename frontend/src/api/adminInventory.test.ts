import { describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import {
  createRoomInventory,
  getRoomInventoryCalendar,
  updateRoomInventory,
} from './adminInventory'
import { inventory, inventoryCalendar } from '../test/inventory'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

function authenticate() {
  const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN')
  setTokenPair(token, 'refresh')
  return token
}
const read = () => getRoomInventoryCalendar(3, '2030-07-20', '2030-07-22')
const writes = [
  () => createRoomInventory(3, { inventoryDate: '2030-07-20', totalQuantity: 5 }),
  () => updateRoomInventory(3, '2030-07-20', { totalQuantity: 5, saleStatus: 'OPEN' }),
]
describe('ADMIN Inventory HTTP contract', () => {
  it('authenticates even Calendar GET, preserves gaps and inclusive range, and forwards AbortSignal', async () => {
    const token = authenticate(),
      controller = new AbortController()
    const fetch = vi.fn().mockResolvedValue(Response.json(inventoryCalendar))
    vi.stubGlobal('fetch', fetch)
    await expect(
      getRoomInventoryCalendar(3, '2030-07-20', '2030-07-22', controller.signal),
    ).resolves.toEqual(inventoryCalendar)
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/rooms\/3\/inventories\?startDate=2030-07-20&endDate=2030-07-22$/)
    expect(init.method).toBe('GET')
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('forwards cancellation while the Calendar request is still pending', async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    vi.stubGlobal('fetch', fetch)
    const pending = getRoomInventoryCalendar(3, '2030-07-20', '2030-07-22', controller.signal)
    const rejected = expect(pending).rejects.toMatchObject({ kind: 'cancelled' })
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    controller.abort()
    await rejected
    expect((fetch.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true)
  })
  it.each(['POST', 'PUT'])(
    'sends only writable %s fields without reserved/available/version',
    async (method) => {
      const token = authenticate()
      const fetch = vi
        .fn()
        .mockResolvedValue(Response.json(inventory, { status: method === 'POST' ? 201 : 200 }))
      vi.stubGlobal('fetch', fetch)
      await writes[method === 'POST' ? 0 : 1]()
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
      expect(url).toMatch(
        method === 'POST' ? /\/rooms\/3\/inventories$/ : /\/rooms\/3\/inventories\/2030-07-20$/,
      )
      expect(init.method).toBe(method)
      expect(JSON.parse(init.body as string)).toEqual(
        method === 'POST'
          ? { inventoryDate: '2030-07-20', totalQuantity: 5 }
          : { totalQuantity: 5, saleStatus: 'OPEN' },
      )
      expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
      expect(fetch).toHaveBeenCalledOnce()
    },
  )
  it.each(writes)('does not refresh or replay a write on 401', async (write) => {
    authenticate()
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: 401, code: 'AUTH_001', message: '인증 필요' }, { status: 401 }),
      )
    vi.stubGlobal('fetch', fetch)
    await expect(write()).rejects.toMatchObject({ status: 401, code: 'AUTH_001' })
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([400, 403, 404, 409, 500])(
    'retains HTTP %s code and field details without replay',
    async (status) => {
      const fetch = vi.fn().mockResolvedValue(
        Response.json(
          {
            status,
            code: 'INVENTORY_006',
            message: '수량 확인',
            errors: [{ field: 'totalQuantity', message: '예약 수량 미만' }],
          },
          { status },
        ),
      )
      vi.stubGlobal('fetch', fetch)
      await expect(writes[1]()).rejects.toMatchObject({
        status,
        code: 'INVENTORY_006',
        fieldErrors: [{ field: 'totalQuantity', message: '예약 수량 미만' }],
      })
      expect(fetch).toHaveBeenCalledOnce()
    },
  )
  it.each([
    {},
    { ...inventoryCalendar, roomId: 4 },
    { ...inventoryCalendar, endDate: '2030-07-23' },
    { ...inventoryCalendar, startDate: '2030-07-19' },
    { ...inventoryCalendar, inventories: null },
    { ...inventoryCalendar, inventories: [inventory, inventory] },
    { ...inventoryCalendar, inventories: [...inventoryCalendar.inventories].reverse() },
    { ...inventoryCalendar, inventories: [{ ...inventory, inventoryDate: '2030-07-19' }] },
    { ...inventoryCalendar, inventories: [{ ...inventory, inventoryDate: '2030-07-23' }] },
    { ...inventoryCalendar, inventories: [{ ...inventory, roomId: 4 }] },
    { ...inventoryCalendar, inventories: [{ ...inventory, availableQuantity: 0 }] },
    { ...inventoryCalendar, inventories: [{ ...inventory, reservedQuantity: 6 }] },
    { ...inventoryCalendar, inventories: [{ ...inventory, totalQuantity: -1 }] },
    { ...inventoryCalendar, inventories: [{ ...inventory, saleStatus: 'UNKNOWN' }] },
    { ...inventoryCalendar, inventories: [{ ...inventory, totalQuantity: 1.5 }] },
    { ...inventoryCalendar, inventories: [null] },
  ])(
    'rejects malformed/wrong-identity Calendar success %j instead of manufacturing stock',
    async (response) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))
      await expect(read()).rejects.toMatchObject({ kind: 'unexpected_response' })
    },
  )
  it.each(writes)('validates write success identity/quantities too', async (write) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...inventory, roomId: 4 })))
    await expect(write()).rejects.toMatchObject({ kind: 'unexpected_response' })
  })
  it('accepts an empty Calendar without inventing rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...inventoryCalendar, inventories: [] })),
    )
    expect((await read()).inventories).toEqual([])
  })
  it.each([
    [0, '2030-07-20', '2030-07-22'],
    [3, '2030-02-30', '2030-07-22'],
    [3, '2030-07-23', '2030-07-22'],
    [3, '2030-07-20', '2030-07-22/other'],
  ] as const)('rejects invalid Calendar targets before HTTP (%s/%s/%s)', async (id, start, end) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(getRoomInventoryCalendar(id, start, end)).rejects.toBeInstanceOf(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })
})
