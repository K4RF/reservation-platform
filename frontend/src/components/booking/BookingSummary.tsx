import { useCallback, type ReactNode } from 'react'
import { getBookingPrice, type BookingPrice } from '../../api/bookingPrice'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import type { RoomResponse } from '../../api/room'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { formatMinorUnits, toMinorUnits } from '../../utils/money'

export function BookingSummary({
  room,
  request,
  compact = false,
  price,
}: {
  room: RoomResponse
  request: AvailabilityRequest
  compact?: boolean
  price?: BookingPriceQuery
}) {
  return price ? (
    <BookingPriceView room={room} request={request} compact={compact} price={price} />
  ) : (
    <BookingPriceSession room={room} request={request}>
      {(query) => (
        <BookingPriceView room={room} request={request} compact={compact} price={query} />
      )}
    </BookingPriceSession>
  )
}

export type BookingPriceQuery = ReturnType<typeof useDetailQuery<BookingPrice>>

// A selected stay owns one read across exploration, guest input and review.
export function BookingPriceSession({
  room,
  request,
  children,
}: {
  room: RoomResponse
  request: AvailabilityRequest
  children: (price: BookingPriceQuery) => ReactNode
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getBookingPrice(room.roomId, request.checkInDate, request.checkOutDate, signal),
    [room.roomId, request.checkInDate, request.checkOutDate],
  )
  const price = useDetailQuery(load)
  return children(price)
}

function BookingPriceView({
  room,
  request,
  compact,
  price,
}: {
  room: RoomResponse
  request: AvailabilityRequest
  compact: boolean
  price: BookingPriceQuery
}) {
  const { state, retry } = price
  if (compact)
    return (
      <section className="booking-summary booking-summary-compact" aria-label="조회 시점 예상 요금">
        <p>
          {request.checkInDate} → {request.checkOutDate} · 총 {request.guestCount}명
        </p>
        {state.status === 'loading' && (
          <LoadingState message="숙박일별 요금을 확인하고 있습니다." />
        )}
        {state.status === 'error' && (
          <ErrorState
            message="요금을 확인하지 못했습니다. 예상 금액을 제공할 수 없습니다."
            onRetry={retry}
          />
        )}
        {state.status === 'success' && (
          <>
            <p className="booking-total">
              총 예상 금액: {formatMinorUnits(state.data.totalMinorUnits)}
            </p>
            <details>
              <summary>{state.data.nights.length}박 요금 내역</summary>
              <ul className="compact-night-prices">
                {state.data.nights.map((night) => (
                  <li key={night.stayDate}>
                    {night.stayDate} ·{' '}
                    <span>{night.source === 'DAILY' ? '날짜별 요금' : '기본 요금'}</span> ·{' '}
                    {formatMinorUnits(toMinorUnits(night.nightlyPrice))}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        <p className="booking-note">조회 시점의 예상 합계이며 가격 보장이 아닙니다.</p>
      </section>
    )
  return (
    <section className="booking-summary" aria-labelledby="booking-summary-title">
      <header className="booking-summary-header">
        <h3 id="booking-summary-title" className="sr-only">
          예약 요약
        </h3>
        <span className="booking-price-basis">조회 시점 예상 요금</span>
      </header>
      {state.status === 'loading' && <LoadingState message="숙박일별 요금을 확인하고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState
          message="요금을 확인하지 못했습니다. 예상 금액을 제공할 수 없습니다."
          onRetry={retry}
        />
      )}
      {state.status === 'success' && (
        <>
          <p className="booking-total" role="status">
            총 예상 금액: {formatMinorUnits(state.data.totalMinorUnits)}
          </p>
          <details className="booking-price-details">
            <summary>{state.data.nights.length}박 요금 내역</summary>
            <p className="booking-note">
              기본 1박 가격:{' '}
              {room.nightlyPrice.toLocaleString('ko-KR', { maximumFractionDigits: 20 })}. 날짜별
              요금을 합산합니다.
            </p>
            <p className="booking-table-hint" id="booking-table-hint">
              좁은 화면에서는 요금 표를 좌우로 스크롤할 수 있습니다.
            </p>
            <div
              className="booking-price-scroll"
              role="region"
              aria-label="숙박일별 요금 표"
              aria-describedby="booking-table-hint"
              tabIndex={0}
            >
              <table className="booking-price-table">
                <caption>숙박일별 적용 요금</caption>
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
            </div>
          </details>
        </>
      )}
      <p className="booking-note">
        예상 합계는 확정 금액이 아닙니다. 최종 금액과 가용성은 예약 시 다시 확인합니다.
      </p>
    </section>
  )
}
