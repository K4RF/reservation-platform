import { Link } from 'react-router'
import type { ReservationCardModel } from './reservationView'

export function ReservationCard({
  reservation,
  linkToDetail = true,
}: {
  reservation: ReservationCardModel
  linkToDetail?: boolean
}) {
  return (
    <article className="reservation-card" aria-label={`예약 ${reservation.id}`}>
      <div className="reservation-card-header">
        <h2>{reservation.accommodationName}</h2>
        <span
          className={`reservation-status reservation-status-${reservation.status.toLowerCase()}`}
        >
          {reservation.statusLabel}
        </span>
      </div>
      <p>객실: {reservation.roomName}</p>
      <p className="reservation-number">예약 번호: {reservation.number}</p>
      <dl className="reservation-facts">
        <div>
          <dt>체크인</dt>
          <dd>
            <time dateTime={reservation.checkInDate}>{reservation.checkInDate}</time>
          </dd>
        </div>
        <div>
          <dt>체크아웃</dt>
          <dd>
            <time dateTime={reservation.checkOutDate}>{reservation.checkOutDate}</time>
          </dd>
        </div>
        <div>
          <dt>숙박 / 인원</dt>
          <dd>
            {reservation.stayNights}박 · {reservation.guestCount}명
          </dd>
        </div>
        <div>
          <dt>확정 예약 금액</dt>
          <dd>{reservation.totalAmount}</dd>
        </div>
      </dl>
      {reservation.catalogUnavailable && (
        <p>현재 숙소·객실 정보 일부를 불러오지 못했습니다. 예약 기록은 유지됩니다.</p>
      )}
      {linkToDetail && (
        <Link to={reservation.detailPath} aria-label={`예약 ${reservation.id} 상세 보기`}>
          예약 상세 보기
        </Link>
      )}
    </article>
  )
}
