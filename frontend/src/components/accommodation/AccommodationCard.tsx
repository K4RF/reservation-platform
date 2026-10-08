import { Link, useLocation } from 'react-router'
import { routePaths } from '../../app/routePaths'
import type { AccommodationCardModel } from './accommodationView'
import { bookingContextPath, readBookingContext } from '../../app/bookingContext'

export function AccommodationCard({ accommodation }: { accommodation: AccommodationCardModel }) {
  const { search } = useLocation()
  const context = readBookingContext(search)
  const detailPath = context
    ? bookingContextPath(accommodation.id, { stay: context.stay, roomPage: 0 })
    : `${routePaths.accommodations}/${accommodation.id}`
  return (
    <article className="accommodation-card">
      <div className="catalog-card-visual" aria-hidden="true">
        <span>STAY / {accommodation.location}</span>
        <small>사진 정보 미제공</small>
      </div>
      <h2>
        <Link to={detailPath}>{accommodation.name}</Link>
      </h2>
      <p>{accommodation.location}</p>
      <p>{accommodation.description}</p>
      <p>{accommodation.status}</p>
      {accommodation.amenities.length > 0 && (
        <ul aria-label="숙소 편의시설">
          {accommodation.amenities.map((amenity) => (
            <li key={amenity}>{amenity}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
