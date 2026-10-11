import { describe, expect, it, vi } from 'vitest'
import { getReservationChangeAvailability } from './reservationChangeAvailability'
import { room, roomPage } from '../test/room'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

const stay = { checkInDate: '2030-01-02', checkOutDate: '2030-01-04', guestCount: 2 }

describe('reservation change general availability lookup', () => {
  it('finds the fixed room after the first page using the existing public GET contract', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          roomPage({
            content: [{ ...room, roomId: 2 }],
            totalElements: 21,
            totalPages: 2,
            last: false,
          }),
        ),
      )
      .mockResolvedValueOnce(
        Response.json(roomPage({ page: 1, first: false, totalElements: 21, totalPages: 2 })),
      )
    vi.stubGlobal('fetch', mock)
    await expect(getReservationChangeAvailability(7, 3, stay)).resolves.toBe('listed')
    expect(mock).toHaveBeenCalledTimes(2)
    mock.mock.calls.forEach(([url, init], index) => {
      const address = new URL(url, 'http://localhost')
      expect(address.pathname).toBe('/api/v1/accommodations/7/rooms/available')
      expect(Object.fromEntries(address.searchParams)).toEqual({
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        guestCount: '2',
        page: String(index),
        size: '20',
      })
      expect(init.method).toBe('GET')
      expect(new Headers(init.headers).has('Authorization')).toBe(false)
      expect(init.body).toBeUndefined()
    })
  })
  it('reports advisory absence only after the final page, never chooses another room', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          roomPage({
            content: [{ ...room, roomId: 1 }],
            totalElements: 21,
            totalPages: 2,
            last: false,
          }),
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          roomPage({
            content: [{ ...room, roomId: 4 }],
            page: 1,
            first: false,
            totalElements: 21,
            totalPages: 2,
          }),
        ),
      )
    vi.stubGlobal('fetch', mock)
    await expect(getReservationChangeAvailability(7, 3, stay)).resolves.toBe('not_listed')
    expect(mock).toHaveBeenCalledTimes(2)
  })
  it('accepts an empty list as advisory absence, not a change rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(roomPage({ content: [], totalElements: 0, totalPages: 0 })),
        ),
    )
    await expect(getReservationChangeAvailability(7, 3, stay)).resolves.toBe('not_listed')
  })
  it('stops after finding the fixed room instead of fetching unrelated pages', async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(Response.json(roomPage({ totalElements: 21, totalPages: 2, last: false })))
    vi.stubGlobal('fetch', mock)
    await expect(getReservationChangeAvailability(7, 3, stay)).resolves.toBe('listed')
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it.each([
    { checkInDate: '', checkOutDate: '2030-01-04', guestCount: 2 },
    { ...stay, checkInDate: '2030-02-30' },
    { ...stay, checkOutDate: '2030-01-02' },
    { ...stay, checkOutDate: '2030-01-01' },
    { ...stay, guestCount: 0 },
  ])('rejects invalid dates/count before any request %j', async (request) => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await expect(getReservationChangeAvailability(7, 3, request)).rejects.toBeInstanceOf(RangeError)
    expect(mock).not.toHaveBeenCalled()
  })
  it.each([
    [0, 3],
    [7, -1],
    [7, NaN],
    [1.5, 3],
  ])('rejects invalid identifiers %s / %s', async (accommodationId, roomId) => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    await expect(
      getReservationChangeAvailability(accommodationId, roomId, stay),
    ).rejects.toBeInstanceOf(RangeError)
    expect(mock).not.toHaveBeenCalled()
  })
  it('does not turn a later-page failure into unavailable and preserves server errors', async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(roomPage({ content: [{ ...room, roomId: 1 }], totalPages: 2, last: false })),
      )
      .mockResolvedValueOnce(
        Response.json(
          { status: 409, code: 'INVENTORY_011', message: '재고 충돌', errors: [] },
          { status: 409 },
        ),
      )
    vi.stubGlobal('fetch', mock)
    await expect(getReservationChangeAvailability(7, 3, stay)).rejects.toMatchObject({
      status: 409,
      code: 'INVENTORY_011',
      message: '재고 충돌',
    })
    expect(mock).toHaveBeenCalledTimes(2)
  })
  it('rejects inconsistent pagination instead of looping or claiming absence', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(roomPage({ content: [], last: false })))
    vi.stubGlobal('fetch', mock)
    await expect(getReservationChangeAvailability(7, 3, stay)).rejects.toMatchObject({
      kind: 'unexpected_response',
    })
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('aborts between pages even if a fetch ignores cancellation', async () => {
    const controller = new AbortController()
    const mock = vi.fn().mockImplementation(() => {
      controller.abort()
      return Response.json(roomPage({ content: [], totalPages: 2, last: false }))
    })
    vi.stubGlobal('fetch', mock)
    await expect(
      getReservationChangeAvailability(7, 3, stay, controller.signal),
    ).rejects.toBeDefined()
    expect(mock).toHaveBeenCalledTimes(1)
  })
})
