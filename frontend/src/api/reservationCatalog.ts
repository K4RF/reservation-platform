import { getRoom } from './room'
import { getAccommodation, type AccommodationResponse } from './accommodation'
import type { ReservationSummary } from './reservationList'
import type { MediaResponse } from './media'

export interface ReservationCatalogInfo {
  roomName: string | null
  accommodationName: string | null
  accommodationId: number | null
  representativeImage?: MediaResponse | null
}

// Page-local deduplication only: never keep member reservation data in a global cache.
// Catalog failures must not hide valid reservation history or its authoritative amounts.
export async function getReservationCatalog(
  reservations: ReservationSummary[],
  signal?: AbortSignal,
): Promise<Map<number, ReservationCatalogInfo>> {
  signal?.throwIfAborted()
  const accommodations = new Map<number, Promise<AccommodationResponse | null>>()
  const rooms = await Promise.all(
    [...new Set(reservations.map((row) => row.roomId))].map(async (id) => {
      const room = await getRoom(id, signal).catch(() => null)
      signal?.throwIfAborted()
      if (!room)
        return [
          id,
          {
            roomName: null,
            accommodationName: null,
            accommodationId: null,
            representativeImage: null,
          },
        ] as const
      let catalog = accommodations.get(room.accommodationId)
      if (!catalog) {
        catalog = getAccommodation(room.accommodationId, signal).catch(() => null)
        accommodations.set(room.accommodationId, catalog)
      }
      const accommodation = await catalog
      signal?.throwIfAborted()
      return [
        id,
        {
          roomName: room.name,
          accommodationName: accommodation?.name ?? null,
          accommodationId: room.accommodationId,
          representativeImage:
            room.representativeImage ?? accommodation?.representativeImage ?? null,
        },
      ] as const
    }),
  )
  return new Map<number, ReservationCatalogInfo>(rooms)
}
