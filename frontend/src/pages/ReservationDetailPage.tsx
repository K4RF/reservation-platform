import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { getReservationDetail } from '../api/reservationDetail'
import { toReservationSummary } from '../api/reservationList'
import { getReservationCatalog } from '../api/reservationCatalog'
import { ReservationCard } from '../components/reservation/ReservationCard'
import { ReservationSnapshots } from '../components/reservation/ReservationSnapshots'
import { reservationReadError, toReservationCard } from '../components/reservation/reservationView'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { useDetailQuery } from './useDetailQuery'
import { routePaths } from '../app/routePaths'
import { getSessionVersion } from '../state/accessToken'
import { useAuth } from '../state/useAuth'

export function ReservationDetailPage() {
  useAuth()
  const { reservationId } = useParams()
  const id = Number(reservationId)
  if (!reservationId || !/^\d+$/.test(reservationId) || !Number.isSafeInteger(id) || id < 1)
    return <ErrorState message="올바르지 않은 예약 ID입니다." />
  return <ReservationDetail key={`${getSessionVersion()}:${id}`} id={id} />
}

function ReservationDetail({ id }: { id: number }) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const detail = await getReservationDetail(id, signal)
      const result = toReservationSummary(detail)
      const catalog = await getReservationCatalog([result], signal)
      return { detail, card: toReservationCard(result, catalog.get(result.roomId)) }
    },
    [id],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <section className="page-content reservation-detail-page">
      <h1>예약 상세</h1>
      {state.status === 'loading' && <LoadingState message="예약을 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={reservationReadError(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <ReservationCard reservation={state.data.card} linkToDetail={false} />
          <p>
            숙소·객실 이름은 현재 정보입니다. 금액은 예약 Snapshot이며 결제 완료를 의미하지
            않습니다.
          </p>
          <ReservationSnapshots reservation={state.data.detail} />
          {state.data.card.catalogUnavailable && (
            <button onClick={retry}>현재 숙소·객실 정보 다시 조회</button>
          )}
        </>
      )}
      <Link to={routePaths.reservations}>내 예약 목록으로</Link>
    </section>
  )
}
