import { expect, vi } from 'vitest'
import type { AccommodationResponse } from '../api/accommodation'
import type { RoomResponse } from '../api/room'
import type { RoomDailyPriceResponse } from '../api/bookingPrice'
import type { RoomInventoryResponse } from '../api/adminInventory'
import { accommodation, accommodationPage } from './accommodation'
import { room, roomPage } from './room'
import { reservationDetail, reservationPage } from './reservation'
import { accessTokenWithExpiry } from './jwt'
import { album, media } from './media'

// Stateful HTTP fixture, NOT a substitute for Spring Security/DB verification.
// Unknown URLs are recorded and rejected; no invented Admin or policy-read API is supported.
export function adminManagementApi(seedCatalog = false) {
  const state = {
    accommodation: seedCatalog
      ? structuredClone(accommodation)
      : (null as AccommodationResponse | null),
    room: seedCatalog ? structuredClone(room) : (null as RoomResponse | null),
    price: null as RoomDailyPriceResponse | null,
    inventories: [] as RoomInventoryResponse[],
    reservation: structuredClone(reservationDetail),
    mediaAlbums: { ACCOMMODATION: album(), ROOM: album({ type: 'ROOM', id: 3 }) },
  }
  const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600, 'ACCESS', 'ADMIN')
  const unexpected: string[] = []
  let writeFailure: { status: number; code: string } | 'network' | undefined
  let nextMediaId = 100
  const respond = (url: string, init: RequestInit) => {
    const { pathname: path, searchParams: params } = new URL(url, 'http://localhost')
    const method = init.method ?? 'GET',
      body =
        init.body && !(init.body instanceof FormData) ? JSON.parse(init.body as string) : undefined
    if (path === '/api/v1/auth/login' && method === 'POST') {
      expect(body).toEqual({ email: 'admin@example.com', password: 'Password123!' })
      expect(new Headers(init.headers).has('Authorization')).toBe(false)
      return Response.json({
        accessToken: token,
        refreshToken: 'admin-refresh',
        tokenType: 'Bearer',
      })
    }
    const inventory = path.includes('/inventories'),
      reservation = path.startsWith('/api/v1/reservations')
    expect(new Headers(init.headers).get('Authorization')).toBe(
      method !== 'GET' || inventory || reservation || path.endsWith('/media')
        ? `Bearer ${token}`
        : null,
    )
    const mediaMatch = path.match(
      /^\/api\/v1\/(accommodations\/7|rooms\/3)\/media(?:\/(\d+)(\/content|\/representative)?|\/(order))?$/,
    )
    if (mediaMatch) {
      const type = mediaMatch[1].startsWith('rooms') ? 'ROOM' : 'ACCOMMODATION'
      const current = state.mediaAlbums[type]
      const reply = () => Response.json(current, { headers: { ETag: current.etag } })
      if (method === 'GET') return reply()
      expect(new Headers(init.headers).get('If-Match')).toBe(current.etag)
      const id = Number(mediaMatch[2])
      const finish = () => {
        current.images.forEach((row, i) => {
          row.image.sortOrder = i
        })
        current.revision = (++nextMediaId).toString(16).padStart(64, '0')
        current.etag = `"${current.revision}"`
        const target = type === 'ROOM' ? state.room : state.accommodation
        if (target) {
          target.images = current.images.map((row) => ({ ...row.image }))
          target.representativeImage = target.images[0] ?? null
        }
        return reply()
      }
      if (init.body instanceof FormData) {
        const formData = init.body
        expect(new Headers(init.headers).has('Content-Type')).toBe(false)
        return new Promise<Response>((resolve, reject) => {
          const reader = new FileReader()
          reader.onerror = () => reject(reader.error)
          reader.onload = () => {
            const metadata = JSON.parse(String(reader.result))
            const item = {
              image: { ...media(++nextMediaId), altText: metadata.altText },
              source: metadata.source,
              rightsRecord: metadata.rightsRecord,
            }
            if (method === 'POST') current.images.push(item)
            else
              current.images.splice(
                current.images.findIndex((row) => row.image.mediaId === id),
                1,
                item,
              )
            resolve(finish())
          }
          reader.readAsText(formData.get('metadata') as Blob)
        })
      }
      const item = current.images.find((row) => row.image.mediaId === id)
      if (method === 'DELETE')
        current.images = current.images.filter((row) => row.image.mediaId !== id)
      else if (mediaMatch[3] === '/representative' && item)
        current.images = [item, ...current.images.filter((row) => row !== item)]
      else if (mediaMatch[4])
        current.images = body.mediaIds.map((id: number) =>
          current.images.find((row) => row.image.mediaId === id)!,
        )
      else if (item) {
        item.image.altText = body.altText
        item.source = body.source
        item.rightsRecord = body.rightsRecord
      }
      return finish()
    }
    if (
      ['/api/v1/rooms/3/inventories', '/api/v1/rooms/3/inventories/2030-07-20'].includes(path) &&
      ['POST', 'PUT'].includes(method) &&
      writeFailure
    ) {
      if (writeFailure === 'network') return Promise.reject(new TypeError('Network unavailable'))
      return error(writeFailure.status, writeFailure.code)
    }
    if (path === '/api/v1/accommodations') {
      if (method === 'GET') {
        const rows =
          state.accommodation &&
          (!params.has('status') || params.get('status') === state.accommodation.status)
            ? [state.accommodation]
            : []
        return Response.json(
          accommodationPage({
            content: rows.map((row) => ({ ...row, images: row.images.slice(0, 1) })),
            totalElements: rows.length,
            totalPages: rows.length ? 1 : 0,
          }),
        )
      }
      if (method === 'POST') {
        state.accommodation = { ...accommodation, ...body, status: 'ACTIVE' }
        return Response.json(state.accommodation, { status: 201 })
      }
    }
    if (path === '/api/v1/accommodations/7') {
      if (method === 'PUT' && state.accommodation)
        state.accommodation = { ...state.accommodation, ...body }
      if (method === 'GET' || method === 'PUT')
        return state.accommodation
          ? Response.json(state.accommodation)
          : error(404, 'ACCOMMODATION_001')
    }
    if (path === '/api/v1/accommodations/7/status' && method === 'PATCH' && state.accommodation) {
      expect(Object.keys(body)).toEqual(['status'])
      state.accommodation = { ...state.accommodation, status: body.status }
      return Response.json(state.accommodation)
    }
    if (
      [
        '/api/v1/accommodations/7/booking-policy',
        '/api/v1/accommodations/7/cancellation-policy',
      ].includes(path) &&
      ['POST', 'PUT'].includes(method)
    ) {
      return Response.json(
        {
          ...body,
          accommodationId: 7,
          [path.endsWith('/booking-policy') ? 'bookingPolicyId' : 'cancellationPolicyId']: 11,
        },
        { status: method === 'POST' ? 201 : 200 },
      )
    }
    if (path === '/api/v1/accommodations/7/rooms') {
      if (method === 'GET') {
        const rows =
          state.room && (!params.has('status') || params.get('status') === state.room.status)
            ? [state.room]
            : []
        return Response.json(
          roomPage({
            content: rows.map((row) => ({ ...row, images: row.images.slice(0, 1) })),
            totalElements: rows.length,
            totalPages: rows.length ? 1 : 0,
          }),
        )
      }
      if (method === 'POST') {
        expect(Object.keys(body).sort()).toEqual(['amenities', 'capacity', 'name', 'nightlyPrice'])
        state.room = { ...room, ...body, status: 'ACTIVE' }
        return Response.json(state.room, { status: 201 })
      }
    }
    if (path === '/api/v1/rooms/3') {
      if (method === 'PUT' && state.room) state.room = { ...state.room, ...body }
      if (method === 'GET' || method === 'PUT')
        return state.room ? Response.json(state.room) : error(404, 'ROOM_001')
    }
    if (path === '/api/v1/rooms/3/status' && method === 'PATCH' && state.room) {
      state.room = { ...state.room, status: body.status }
      return Response.json(state.room)
    }
    if (path === '/api/v1/rooms/3/prices' && method === 'POST') {
      expect(Object.keys(body).sort()).toEqual(['nightlyPrice', 'stayDate'])
      state.price = {
        roomDailyPriceId: 9,
        roomId: 3,
        stayDate: body.stayDate,
        nightlyPrice: body.nightlyPrice,
        source: 'DAILY',
      }
      return Response.json(state.price, { status: 201 })
    }
    if (path === '/api/v1/rooms/3/prices/2030-07-20') {
      if (method === 'PUT' && state.price) {
        expect(Object.keys(body)).toEqual(['nightlyPrice'])
        state.price = { ...state.price, nightlyPrice: body.nightlyPrice }
      }
      if (method === 'GET' || method === 'PUT')
        return Response.json(
          state.price ?? {
            roomDailyPriceId: null,
            roomId: 3,
            stayDate: '2030-07-20',
            nightlyPrice: state.room!.nightlyPrice,
            source: 'DEFAULT',
          },
        )
    }
    if (path === '/api/v1/rooms/3/inventories') {
      if (method === 'GET')
        return Response.json({
          roomId: 3,
          startDate: params.get('startDate'),
          endDate: params.get('endDate'),
          inventories: state.inventories
            .filter(
              (row) =>
                row.inventoryDate >= params.get('startDate')! &&
                row.inventoryDate <= params.get('endDate')!,
            )
            .sort((a, b) => a.inventoryDate.localeCompare(b.inventoryDate)),
        })
      if (method === 'POST') {
        expect(Object.keys(body).sort()).toEqual(['inventoryDate', 'totalQuantity'])
        const row: RoomInventoryResponse = {
          inventoryId: 19,
          roomId: 3,
          inventoryDate: body.inventoryDate,
          totalQuantity: body.totalQuantity,
          reservedQuantity: 0,
          availableQuantity: body.totalQuantity,
          saleStatus: 'OPEN',
        }
        state.inventories.push(row)
        return Response.json(row, { status: 201 })
      }
    }
    if (path === '/api/v1/rooms/3/inventories/2030-07-20' && method === 'PUT') {
      expect(Object.keys(body).sort()).toEqual(['saleStatus', 'totalQuantity'])
      const row = state.inventories[0]
      Object.assign(row, body, { availableQuantity: body.totalQuantity - row.reservedQuantity })
      return Response.json(row)
    }
    if (path === '/api/v1/reservations' && method === 'GET') {
      expect(params.has('memberId')).toBe(false)
      expect(params.has('role')).toBe(false)
      return Response.json(reservationPage({ content: [state.reservation] }))
    }
    if (path === '/api/v1/reservations/42' && method === 'GET')
      return Response.json(state.reservation)
    if (path === '/api/v1/reservations/43' && method === 'GET') return error(403, 'RESERVATION_004')
    unexpected.push(`${method} ${path}`)
    throw new Error(`Unexpected API ${method} ${path}`)
  }
  const fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
    try {
      return respond(url, init)
    } catch (error) {
      // apiClient normalizes thrown fixture assertions as network errors. Preserve
      // them so an expected error-state test cannot accidentally hide a bad request.
      unexpected.push(`Contract assertion: ${init.method} ${url}`)
      throw error
    }
  })
  vi.stubGlobal('fetch', fetch)
  return {
    state,
    fetch,
    token,
    unexpected,
    failWrites: (failure: typeof writeFailure) => {
      writeFailure = failure
    },
  }
}
function error(status: number, code: string) {
  return Response.json(
    {
      status,
      code,
      message: '서버 요청 거절',
      errors: [{ field: 'totalQuantity', message: '수량 확인' }],
    },
    { status },
  )
}
