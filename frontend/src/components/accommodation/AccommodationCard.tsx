import { Link, useLocation } from 'react-router'
import type { AccommodationCardModel } from './accommodationView'
import { explorationDetailPath } from '../../app/bookingContext'
import { canonicalSearchQuery } from './searchQuery'
import { rememberSearchPosition } from '../../app/explorationPosition'

export function AccommodationCard({ accommodation }: { accommodation: AccommodationCardModel }) {
  const { search } = useLocation()
  const detailPath = explorationDetailPath(accommodation.id, search)
  return (
    <article className="accommodation-card catalog-stay-card">
      <div className="catalog-card-visual" aria-hidden="true">
        <span>STAY / {accommodation.location}</span>
        <small>사진 정보 미제공</small>
      </div>
      <h2>
        <Link
          id={`accommodation-link-${accommodation.id}`}
          to={detailPath}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              const query = canonicalSearchQuery(search)
              if (query !== null) rememberSearchPosition(query, event.currentTarget)
            }
          }}
        >
          {accommodation.name}
        </Link>
      </h2>
      <p className="catalog-location">{accommodation.location}</p>
      <p className="catalog-description">{accommodation.description}</p>
      <p className="catalog-status">{accommodation.status}</p>
      {accommodation.amenities.length > 0 && (
        <ul className="catalog-amenities" aria-label="숙소 편의시설">
          {accommodation.amenities.map((amenity) => (
            <li key={amenity}>{amenity}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
