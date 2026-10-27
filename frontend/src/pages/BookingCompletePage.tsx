import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { getReservation } from '../api/reservation'
import { useDetailQuery } from './useDetailQuery'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { formatMinorUnits, toMinorUnits } from '../utils/money'
import { routePaths } from '../app/routePaths'

export function BookingCompletePage() {
  const { reservationId } = useParams()
  const id = Number(reservationId)
  if (!reservationId || !/^\d+$/.test(reservationId) || !Number.isSafeInteger(id) || id < 1)
    return <ErrorState message="올바르지 않은 예약 ID입니다." />
  return <BookingComplete key={id} id={id} />
}
function BookingComplete({ id }: { id: number }) {
  const load = useCallback((signal: AbortSignal) => getReservation(id, signal), [id])
  const { state, retry } = useDetailQuery(load)
  return (
    <section className="page-content booking-complete-page">
      <header className="booking-complete-header">
        <p className="booking-eyebrow">YOUR RESERVATION</p>
        <h1>예약 결과 확인</h1>
        <p>서버에 저장된 결과를 확인하고 다음 여정을 준비하세요.</p>
      </header>
      {state.status === 'loading' && (
        <LoadingState message="서버의 예약 결과를 확인하고 있습니다." />
      )}
      {state.status === 'error' && (
        <ErrorState
          message={
            state.notFound
              ? '예약을 찾을 수 없습니다.'
              : '예약 결과를 조회할 수 없습니다. 로그인과 예약 소유 권한을 확인하세요. 생성 요청은 다시 보내지 않습니다.'
          }
          onRetry={retry}
        />
      )}
      {state.status === 'success' && (
        <>
          <h2 className={`booking-result-status booking-result-${state.data.status.toLowerCase()}`}>
            {state.data.status === 'CONFIRMED' ? '예약이 확정되었습니다.' : '취소된 예약입니다.'}
          </h2>
          <div className="booking-result-grid">
            <section className="booking-result-stay" aria-labelledby="booking-result-stay-title">
              <h3 id="booking-result-stay-title">저장된 예약 정보</h3>
              <p className="booking-result-number">
                예약 번호: {state.data.reservationNumber ?? '미등록'}
              </p>
              <p>예약 ID: {state.data.reservationId}</p>
              <p>객실 ID: {state.data.roomId}</p>
              <p>
                {state.data.checkInDate} ~ {state.data.checkOutDate} · {state.data.stayNights}박 ·{' '}
                {state.data.guestCount}명
              </p>
              <p className="booking-note">체크아웃 날짜는 숙박일에 포함되지 않습니다.</p>
            </section>
            <section
              className="booking-result-amount"
              aria-labelledby="booking-result-amount-title"
            >
              <h3 id="booking-result-amount-title">서버 저장 금액</h3>
              <span className="booking-price-basis">예상 요금과 구분되는 저장 Snapshot</span>
              <p className="booking-total">
                예약 금액 Snapshot: {formatMinorUnits(toMinorUnits(state.data.totalAmount, 19))}
              </p>
              <p className="booking-note">
                현재 요금을 다시 합산하지 않고 저장된 응답을 표시합니다.
              </p>
            </section>
            <section className="booking-result-guest" aria-labelledby="booking-result-guest-title">
              <h3 id="booking-result-guest-title">저장된 대표 투숙객</h3>
              {state.data.representativeGuest ? (
                <div className="booking-guest-details">
                  <p>대표 투숙객: {state.data.representativeGuest.name}</p>
                  <p>안내 이메일: {state.data.representativeGuest.email}</p>
                  <p>연락처: {state.data.representativeGuest.phone}</p>
                </div>
              ) : (
                <p>과거 예약의 대표 투숙객 정보가 없습니다.</p>
              )}
            </section>
          </div>
          <p className="booking-note">
            서버에 저장된 예약 결과입니다. 결제 완료를 의미하지 않습니다.
          </p>
        </>
      )}
      <nav className="action-group booking-result-actions" aria-label="예약 결과 다음 단계">
        <Link to={routePaths.accommodations}>숙소 검색으로 돌아가기</Link>
        <Link className="primary-action" to={routePaths.reservations}>
          내 예약 목록 확인
        </Link>
      </nav>
    </section>
  )
}
