import { useCallback, useState } from 'react'
import { getAccommodationRooms } from '../../api/room'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { LoadingState } from '../ui/LoadingState'
import { ErrorState } from '../ui/ErrorState'
import { RoomList } from './RoomList'

export function RoomListSection({ accommodationId }: { accommodationId: number }) {
  const [page, setPage] = useState(0)
  const load = useCallback(
    (signal: AbortSignal) => getAccommodationRooms(accommodationId, page, signal),
    [accommodationId, page],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <section aria-labelledby="room-list-title">
      <h2 id="room-list-title">객실 정보</h2>
      <p>기본 가격이며 날짜별 가격·총액·예약 가능 여부는 아닙니다. API에 통화 정보는 없습니다.</p>
      {state.status === 'loading' && <LoadingState message="객실을 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message="객실을 불러오지 못했습니다." onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <RoomList rooms={state.data.content} />
          <nav className="accommodation-pagination" aria-label="객실 페이지">
            <button disabled={state.data.first} onClick={() => setPage(state.data.page - 1)}>
              이전 객실
            </button>
            <span>
              {state.data.totalPages ? state.data.page + 1 : 0} / {state.data.totalPages} 페이지
            </span>
            <button disabled={state.data.last} onClick={() => setPage(state.data.page + 1)}>
              다음 객실
            </button>
          </nav>
        </>
      )}
    </section>
  )
}
