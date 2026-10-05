import { useCallback } from 'react'
import { getBookingPrice } from '../../api/bookingPrice'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import type { RoomResponse } from '../../api/room'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'

export function BookingSummary({
  room,
  request,
}: {
  room: RoomResponse
  request: AvailabilityRequest
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getBookingPrice(room.roomId, request.checkInDate, request.checkOutDate, signal),
    [room.roomId, request.checkInDate, request.checkOutDate],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <section aria-labelledby="booking-summary-title">
      <h3 id="booking-summary-title">예약 요약</h3>
      <p>
        객실: {room.name} · 최대 {room.capacity}명 · 요청 {request.guestCount}명
      </p>
      <p>
        {request.checkInDate} ~ {request.checkOutDate} (체크아웃 날짜 제외)
      </p>
      <p>
        객실 기본 1박 가격:{' '}
        {room.nightlyPrice.toLocaleString('ko-KR', { maximumFractionDigits: 20 })}
      </p>
      {state.status === 'loading' && <LoadingState message="숙박일별 요금을 확인하고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState
          message="요금을 확인하지 못했습니다. 예상 금액을 제공할 수 없습니다."
          onRetry={retry}
        />
      )}
      {state.status === 'success' && (
        <>
          <p>{state.data.nights.length}박</p>
          <table className="booking-price-table">
            <caption>숙박일별 Backend 적용 요금</caption>
            <thead>
              <tr>
                <th scope="col">숙박일</th>
                <th scope="col">가격 출처</th>
                <th scope="col">적용 요금</th>
              </tr>
            </thead>
            <tbody>
              {state.data.nights.map((night) => (
                <tr key={night.stayDate}>
                  <th scope="row">{night.stayDate}</th>
                  <td>{night.source === 'DAILY' ? '날짜별 요금' : '기본 요금'}</td>
                  <td>{formatMinorUnits(toMinorUnits(night.nightlyPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p role="status">총 예상 금액: {formatMinorUnits(state.data.totalMinorUnits)}</p>
        </>
      )}
      <p>통화·세금·추가 수수료·Add-on 정보는 API에 없습니다. 별도 금액을 추가하지 않습니다.</p>
      <p>
        조회 시점의 예상 합계이며 가격 보장이 아닙니다. 최종 금액은 예약 생성 시 Backend가 다시
        계산합니다.
      </p>
    </section>
  )
}
