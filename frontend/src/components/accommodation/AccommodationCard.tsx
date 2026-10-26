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
      <div className="catalog-card-visual">
        <svg aria-hidden="true" focusable="false" viewBox="0 0 48 36" fill="none">
          <rect x="1" y="1" width="46" height="34" rx="2" stroke="currentColor" />
          <path d="m2 29 13-12 9 8 8-7 14 12" stroke="currentColor" />
          <circle cx="33" cy="10" r="3" stroke="currentColor" />
        </svg>
        <span>사진 정보 미제공</span>
      </div>
      <div className="catalog-card-content">
        <p className="catalog-location">{accommodation.location}</p>
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
        <p className="catalog-description">{accommodation.description}</p>
        <p className="catalog-status">{accommodation.status}</p>
        {accommodation.amenities.length > 0 && (
          <ul className="catalog-amenities" aria-label="숙소 편의시설">
            {accommodation.amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
        )}
        <p className="catalog-card-guidance">숙소명을 선택해 객실과 숙박 조건을 확인하세요.</p>
      </div>
    </article>
  )
}
