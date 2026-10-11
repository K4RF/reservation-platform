import { getRoom } from './room'
import { getAccommodation } from './accommodation'
import type { ReservationSummary } from './reservationList'

export interface ReservationCatalogInfo {
  roomName: string | null
  accommodationName: string | null
  accommodationId: number | null
}

// Page-local deduplication only: never keep member reservation data in a global cache.
// Catalog failures must not hide valid reservation history or its authoritative amounts.
export async function getReservationCatalog(
  reservations: ReservationSummary[],
  signal?: AbortSignal,
): Promise<Map<number, ReservationCatalogInfo>> {
  signal?.throwIfAborted()
  const accommodations = new Map<number, Promise<string | null>>()
  const rooms = await Promise.all(
    [...new Set(reservations.map((row) => row.roomId))].map(async (id) => {
      const room = await getRoom(id, signal).catch(() => null)
      signal?.throwIfAborted()
      if (!room)
        return [id, { roomName: null, accommodationName: null, accommodationId: null }] as const
      let name = accommodations.get(room.accommodationId)
      if (!name) {
        name = getAccommodation(room.accommodationId, signal)
          .then((row) => row.name)
          .catch(() => null)
        accommodations.set(room.accommodationId, name)
      }
      return [
        id,
        {
          roomName: room.name,
          accommodationName: await name,
          accommodationId: room.accommodationId,
        },
      ] as const
    }),
  )
  return new Map<number, ReservationCatalogInfo>(rooms)
}
