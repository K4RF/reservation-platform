import { describe, expect, it, vi } from 'vitest'
import { searchAccommodationRooms } from './room'
import { saveRoom, changeRoomStatus } from './adminRoom'
import { room, roomPage, roomWrite } from '../test/room'
import { accessTokenWithExpiry } from '../test/jwt'
import { setTokenPair } from '../state/accessToken'

function authenticate() {
  const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN')
  setTokenPair(token, 'refresh')
  return token
}
describe('Room Admin API contracts', () => {
  it('reuses the public scoped list with supported filters and no availability/ACTIVE default', async () => {
    authenticate()
    const fetch = vi.fn().mockResolvedValue(Response.json(roomPage()))
    vi.stubGlobal('fetch', fetch)
    await searchAccommodationRooms(7, {
      minCapacity: 2,
      minPrice: '0',
      maxPrice: '200000.50',
      status: 'INACTIVE',
      amenities: ['WIFI', 'AIR_CONDITIONER'],
      page: 0,
      size: 10,
      sortBy: 'NIGHTLY_PRICE',
      direction: 'DESC',
    })
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    const query = new URL(url, 'http://localhost').searchParams
    expect(url).toMatch(/\/accommodations\/7\/rooms\?/)
    expect(Object.fromEntries(query)).toMatchObject({
      minCapacity: '2',
      minPrice: '0',
      maxPrice: '200000.50',
      status: 'INACTIVE',
      page: '0',
      size: '10',
      sortBy: 'NIGHTLY_PRICE',
      direction: 'DESC',
    })
    expect(query.getAll('amenities')).toEqual(['WIFI', 'AIR_CONDITIONER'])
    expect(query.has('available')).toBe(false)
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })
  it('omits an unspecified status and accepts inactive rooms', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json(roomPage({ content: [{ ...room, status: 'INACTIVE' }] })))
    vi.stubGlobal('fetch', fetch)
    await searchAccommodationRooms(7, { page: 0, status: undefined })
    expect(new URL(fetch.mock.calls[0][0], 'http://localhost').searchParams.has('status')).toBe(
      false,
    )
  })
  it.each([null, 3])(
    'uses the real write URL/method for room %s and sends only Room DTO fields',
    async (id) => {
      const token = authenticate(),
        fetch = vi.fn().mockResolvedValue(Response.json(room))
      vi.stubGlobal('fetch', fetch)
      await expect(saveRoom(7, id, roomWrite)).resolves.toEqual(room)
      const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
      expect(url).toMatch(id === null ? /\/accommodations\/7\/rooms$/ : /\/rooms\/3$/)
      expect(init.method).toBe(id === null ? 'POST' : 'PUT')
      expect(JSON.parse(init.body as string)).toEqual(roomWrite)
      expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)
      expect(JSON.parse(init.body as string)).not.toHaveProperty('accommodationId')
      expect(JSON.parse(init.body as string)).not.toHaveProperty('status')
    },
  )
  it('changes status by PATCH only without DELETE, price or inventory side requests', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ ...room, status: 'INACTIVE' }))
    vi.stubGlobal('fetch', fetch)
    await changeRoomStatus(7, 3, 'INACTIVE')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toMatch(/\/rooms\/3\/status$/)
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'INACTIVE' }),
    })
  })
  it.each([
    () => saveRoom(7, null, roomWrite),
    () => saveRoom(7, 3, roomWrite),
    () => changeRoomStatus(7, 3, 'INACTIVE'),
  ])('never refreshes and replays a write rejected with 401', async (call) => {
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
    'preserves HTTP %s and field errors without retry',
    async (status) => {
      const fetch = vi.fn().mockResolvedValue(
        Response.json(
          {
            status,
            code: 'ROOM_ERROR',
            message: '객실 요청 거절',
            errors: [{ field: 'capacity', message: '인원 확인' }],
            path: '/api/v1/rooms/3',
          },
          { status },
        ),
      )
      vi.stubGlobal('fetch', fetch)
      await expect(saveRoom(7, 3, roomWrite)).rejects.toMatchObject({
        status,
        code: 'ROOM_ERROR',
        fieldErrors: [{ field: 'capacity', message: '인원 확인' }],
      })
      expect(fetch).toHaveBeenCalledOnce()
    },
  )
  it.each([{}, { ...room, roomId: 4 }, { ...room, accommodationId: 8 }, { ...room, capacity: 0 }])(
    'rejects malformed or wrong-resource write response %j',
    async (response) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))
      await expect(saveRoom(7, 3, roomWrite)).rejects.toMatchObject({ kind: 'unexpected_response' })
    },
  )
  it('also checks the parent of newly created rooms and the requested status', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ...room, accommodationId: 8 }))
      .mockResolvedValueOnce(Response.json(room))
    vi.stubGlobal('fetch', fetch)
    await expect(saveRoom(7, null, roomWrite)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
    await expect(changeRoomStatus(7, 3, 'INACTIVE')).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
  })
})
