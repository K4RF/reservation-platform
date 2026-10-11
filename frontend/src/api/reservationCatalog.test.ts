import { describe, expect, it, vi } from 'vitest'
import { getReservationCatalog } from './reservationCatalog'
import { getRoom } from './room'
import { reservationResult } from '../test/reservation'
import { room } from '../test/room'
import { accommodation } from '../test/accommodation'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

describe('reservation catalog enrichment', () => {
  it('deduplicates rooms/accommodations per page and keeps catalog GETs public', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        Response.json(
          url.endsWith('/accommodations/7')
            ? accommodation
            : { ...room, roomId: Number(url.split('/').pop()) },
        ),
      )
    vi.stubGlobal('fetch', mock)
    const result = await getReservationCatalog([
      reservationResult,
      { ...reservationResult, reservationId: 43 },
      { ...reservationResult, reservationId: 44, roomId: 4 },
    ])
    expect(mock).toHaveBeenCalledTimes(3)
    expect(result.get(3)).toEqual({
      roomName: room.name,
      accommodationName: accommodation.name,
      accommodationId: 7,
    })
    expect(result.get(4)?.accommodationName).toBe(accommodation.name)
    expect(
      mock.mock.calls.every(([, init]) => !new Headers(init.headers).has('Authorization')),
    ).toBe(true)
  })
  it('keeps a reservation accessible when its room or accommodation lookup fails', async () => {
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.endsWith('/rooms/3')
          ? Response.json({ ...room, status: 'INACTIVE' })
          : Response.json({}, { status: 404 }),
      )
    vi.stubGlobal('fetch', mock)
    const result = await getReservationCatalog([
      reservationResult,
      { ...reservationResult, roomId: 4 },
    ])
    expect(result.get(3)).toEqual({
      roomName: room.name,
      accommodationName: null,
      accommodationId: 7,
    })
    expect(result.get(4)).toEqual({
      roomName: null,
      accommodationName: null,
      accommodationId: null,
    })
  })
  it('does not fetch anything for an empty reservation page', async () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    expect((await getReservationCatalog([])).size).toBe(0)
    expect(mock).not.toHaveBeenCalled()
  })
  it('does not start catalog requests after the page was abandoned', async () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    const controller = new AbortController()
    controller.abort()
    await expect(getReservationCatalog([reservationResult], controller.signal)).rejects.toBeTruthy()
    expect(mock).not.toHaveBeenCalled()
  })
  it('validates the room detail identity and blocks invalid IDs before fetch', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json({ ...room, roomId: 4 }))
    vi.stubGlobal('fetch', mock)
    await expect(getRoom(3)).rejects.toMatchObject({ kind: 'unexpected_response' })
    mock.mockClear()
    await expect(getRoom(0)).rejects.toBeInstanceOf(RangeError)
    expect(mock).not.toHaveBeenCalled()
  })
})
