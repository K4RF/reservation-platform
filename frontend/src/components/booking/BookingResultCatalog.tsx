import { useCallback } from 'react'
import { getRoom } from '../../api/room'
import { getAccommodation } from '../../api/accommodation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { CatalogImage } from '../media/CatalogImage'

/** Optional current catalog, never the authority for the saved reservation result. */
export function BookingResultCatalog({ roomId }: { roomId: number }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const room = await getRoom(roomId, signal)
      const accommodation = await getAccommodation(room.accommodationId, signal).catch(() => null)
      signal.throwIfAborted()
      return { room, accommodation }
    },
    [roomId],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <section className="booking-result-catalog" aria-label="현재 숙소·객실 정보">
      {state.status === 'loading' && <p>객실 정보를 확인하고 있습니다.</p>}
      {state.status === 'error' && (
        <>
          <p>객실 #{roomId} · 현재 이름과 사진을 불러오지 못했습니다.</p>
          <button type="button" onClick={retry}>
            객실 정보 다시 보기
          </button>
        </>
      )}
      {state.status === 'success' && (
        <>
          <CatalogImage
            image={
              state.data.room.representativeImage ??
              state.data.accommodation?.representativeImage ??
              null
            }
            label="숙소·객실 사진"
            priority
          />
          <div>
            <h3>{state.data.accommodation?.name ?? '숙소 이름 미제공'}</h3>
            <p>{state.data.room.name}</p>
            <p className="booking-note">이름과 사진은 현재 정보이며 예약 당시 기록이 아닙니다.</p>
          </div>
        </>
      )}
    </section>
  )
}
