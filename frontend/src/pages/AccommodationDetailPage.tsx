import { useCallback } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useAuth } from '../state/useAuth'
import {
  bookingContextPath,
  readBookingContext,
  searchReturnPath,
  isExplorationQuery,
} from '../app/bookingContext'
import { getAccommodation } from '../api/accommodation'
import { AccommodationInfo } from '../components/accommodation/AccommodationInfo'
import { RoomListSection } from '../components/room/RoomListSection'
import { RoomAvailabilitySection } from '../components/room/RoomAvailabilitySection'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { bookingCompletePath, routePaths } from '../app/routePaths'
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
  const navigate = useNavigate()
  const location = useLocation()
  const { state: auth } = useAuth()
  const canBook = auth.status === 'authenticated' && (auth.role === 'USER' || auth.role === 'ADMIN')
  const load = useCallback((signal: AbortSignal) => getAccommodation(id, signal), [id])
  const { state, retry } = useDetailQuery(load)
  const initialContext = readBookingContext(location.search)
  const params = new URLSearchParams(location.search)
  const searchQuery = isExplorationQuery(location.search)
    ? (params.get('search') ?? undefined)
    : undefined
  const invalidContext =
    !isExplorationQuery(location.search) ||
    ([...params.keys()].some((key) => key !== 'search') && !initialContext)
  return (
    <div className="accommodation-search-page accommodation-detail-page">
      <Link to={searchReturnPath(location.search)} state={{ restoreSearchPosition: true }}>
        숙소 검색으로 돌아가기
      </Link>
      {invalidContext && (
        <ErrorState message="올바르지 않은 탐색 조건입니다. 날짜와 인원을 다시 입력하세요." />
      )}
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
          <RoomAvailabilitySection
            key={`availability-${id}-${location.search}`}
            initialContext={initialContext}
            onLoginRequired={
              !canBook
                ? (context) => {
                    const target = bookingContextPath(id, { ...context, searchQuery })
                    // Back from Login must also restore public hints, never a guest/price snapshot.
                    navigate(target, { replace: true })
                    navigate(routePaths.login, { state: { from: target } })
                  }
                : undefined
            }
            accommodationId={id}
            accommodationName={state.data.name}
            onComplete={(reservationId) =>
              navigate(bookingCompletePath(reservationId), { replace: true })
            }
          />
          <RoomListSection key={id} accommodationId={id} />
        </>
      )}
    </div>
  )
}
