import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { getAccommodation } from '../api/accommodation'
import { AccommodationInfo } from '../components/accommodation/AccommodationInfo'
import { RoomListSection } from '../components/room/RoomListSection'
import { RoomAvailabilitySection } from '../components/room/RoomAvailabilitySection'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { routePaths } from '../app/routePaths'
import { useDetailQuery } from './useDetailQuery'

export function AccommodationDetailPage() {
  const { accommodationId } = useParams()
  const id = Number(accommodationId)
  if (!accommodationId || !/^\d+$/.test(accommodationId) || !Number.isSafeInteger(id) || id < 1) {
    return (
      <section className="page-content">
        <h1>올바르지 않은 숙소 ID입니다.</h1>
        <Link to={routePaths.accommodations}>숙소 검색으로 돌아가기</Link>
      </section>
    )
  }
  return <AccommodationDetail key={id} id={id} />
}

function AccommodationDetail({ id }: { id: number }) {
  const load = useCallback((signal: AbortSignal) => getAccommodation(id, signal), [id])
  const { state, retry } = useDetailQuery(load)
  return (
    <div className="accommodation-search-page accommodation-detail-page">
      <Link to={routePaths.accommodations}>숙소 검색으로 돌아가기</Link>
      {state.status === 'loading' && <LoadingState message="숙소 상세를 불러오고 있습니다." />}
      {state.status === 'error' &&
        (state.notFound ? (
          <h1>숙소를 찾을 수 없습니다.</h1>
        ) : (
          <ErrorState message="숙소 상세를 불러오지 못했습니다." onRetry={retry} />
        ))}
      {state.status === 'success' && (
        <>
          <AccommodationInfo accommodation={state.data} />
          <RoomAvailabilitySection key={`availability-${id}`} accommodationId={id} />
          <RoomListSection key={id} accommodationId={id} />
        </>
      )}
    </div>
  )
}
