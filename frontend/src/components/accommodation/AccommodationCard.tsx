import { Link } from 'react-router'
import { routePaths } from '../../app/routePaths'
import type { AccommodationCardModel } from './accommodationView'

export function AccommodationCard({ accommodation }: { accommodation: AccommodationCardModel }) {
  return (
    <article className="accommodation-card">
      <h2>
        <Link to={`${routePaths.accommodations}/${accommodation.id}`}>{accommodation.name}</Link>
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
