import { Link } from 'react-router'
import { routePaths } from '../../app/routePaths'
import { ReservationCard } from './ReservationCard'
import type { ReservationCardModel } from './reservationView'

export function ReservationList({ reservations }: { reservations: ReservationCardModel[] }) {
  if (!reservations.length)
    return (
      <div className="empty-state">
        <p role="status">표시할 예약이 없습니다.</p>
        <Link to={routePaths.accommodations}>숙소 둘러보기</Link>
      </div>
    )
  return (
    <ul className="reservation-list" aria-label="내 예약 목록">
      {reservations.map((reservation) => (
        <li key={reservation.id}>
          <ReservationCard reservation={reservation} />
        </li>
      ))}
    </ul>
  )
}
