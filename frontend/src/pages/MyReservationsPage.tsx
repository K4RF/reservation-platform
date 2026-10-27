import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { getReservations } from '../api/reservationList'
import { getReservationCatalog } from '../api/reservationCatalog'
import { ReservationList } from '../components/reservation/ReservationList'
import { reservationReadError, toReservationCard } from '../components/reservation/reservationView'
import { LoadingState } from '../components/ui/LoadingState'
import { ErrorState } from '../components/ui/ErrorState'
import { useDetailQuery } from './useDetailQuery'
import { getSessionVersion } from '../state/accessToken'
import { useAuth } from '../state/useAuth'

export function MyReservationsPage() {
  // A new sign-in must not reuse the previous member's list, even with the same role.
  useAuth()
  return <MyReservations key={getSessionVersion()} />
}

function MyReservations() {
  const [params, setParams] = useSearchParams()
  const rawPage = params.get('page') ?? '0'
  const page = Number(rawPage)
  const valid =
    params.getAll('page').length <= 1 &&
    /^\d+$/.test(rawPage) &&
    Number.isSafeInteger(page) &&
    page <= 2147483647
  const load = useCallback(
    async (signal: AbortSignal) => {
      const result = await getReservations({ page }, signal)
      const catalog = await getReservationCatalog(result.content, signal)
      return {
        ...result,
        cards: result.content.map((row) => toReservationCard(row, catalog.get(row.roomId))),
      }
    },
    [page],
  )
  // Invalid URLs are rejected before the query component can request anything.
  if (!valid)
    return (
      <section className="page-content">
        <h1>내 예약</h1>
        <ErrorState message="올바르지 않은 예약 페이지 번호입니다." />
        <button onClick={() => setParams({})}>첫 페이지로 이동</button>
      </section>
    )
  return <ReservationPage load={load} onPage={(next) => setParams({ page: String(next) })} />
}

function ReservationPage({
  load,
  onPage,
}: {
  load: (signal: AbortSignal) => Promise<
    Awaited<ReturnType<typeof getReservations>> & {
      cards: ReturnType<typeof toReservationCard>[]
    }
  >
  onPage: (page: number) => void
}) {
  const { state, retry } = useDetailQuery(load)
  return (
    <section className="page-content my-reservations-page" aria-labelledby="my-reservations-title">
      <header className="reservation-page-header">
        <p className="reservation-eyebrow">YOUR STAYS</p>
        <h1 id="my-reservations-title">내 예약</h1>
        <p>본인이 생성한 예약을 최신 예약 ID 순서로 확인합니다.</p>
      </header>
      <div className="reservation-context-note">
        <p className="reservation-source-label">기록을 읽는 기준</p>
        <p>숙소·객실 이름은 현재 카탈로그 정보이며 예약 당시 이름의 Snapshot이 아닙니다.</p>
        <p>금액은 서버에 저장된 예약 Snapshot이며 결제 완료나 실제 환불을 의미하지 않습니다.</p>
      </div>
      {state.status === 'loading' && <LoadingState message="내 예약을 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={reservationReadError(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <p className="reservation-result-count" role="status">
            총 {state.data.totalElements}개 예약
          </p>
          <ReservationList reservations={state.data.cards} />
          {state.data.cards.some((card) => card.catalogUnavailable) && (
            <button onClick={retry}>현재 숙소·객실 정보 다시 조회</button>
          )}
          <nav className="accommodation-pagination reservation-pagination" aria-label="예약 페이지">
            <button disabled={state.data.first} onClick={() => onPage(state.data.page - 1)}>
              이전
            </button>
            <span>
              {state.data.totalPages ? state.data.page + 1 : 0} / {state.data.totalPages} 페이지
            </span>
            <button disabled={state.data.last} onClick={() => onPage(state.data.page + 1)}>
              다음
            </button>
          </nav>
          {state.data.content.length === 0 && state.data.page > 0 && (
            <button onClick={() => onPage(0)}>첫 페이지로 이동</button>
          )}
        </>
      )}
    </section>
  )
}
