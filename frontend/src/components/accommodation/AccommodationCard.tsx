import { Link, useLocation } from 'react-router'
import type { AccommodationCardModel } from './accommodationView'
import { explorationDetailPath } from '../../app/bookingContext'
import { canonicalSearchQuery } from './searchQuery'
import { rememberSearchPosition } from '../../app/explorationPosition'
import { CatalogImage } from '../media/CatalogImage'
import type { MouseEvent } from 'react'

export function AccommodationCard({
  accommodation,
  priority = false,
}: {
  accommodation: AccommodationCardModel
  priority?: boolean
}) {
  const { search } = useLocation()
  const detailPath = explorationDetailPath(accommodation.id, search)
  function remember(event: MouseEvent<HTMLAnchorElement>) {
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
  }
  const longDescription = accommodation.description.length > 100
  return (
    <article className="accommodation-card catalog-stay-card">
      <CatalogImage
        image={accommodation.representativeImage}
        priority={priority}
        label="숙소 사진"
      />
      <div className="catalog-card-content">
        <p className="catalog-location">{accommodation.shortLocation}</p>
        <h2>
          <Link id={`accommodation-link-${accommodation.id}`} to={detailPath} onClick={remember}>
            {accommodation.name}
          </Link>
        </h2>
        <p className="catalog-description">
          {longDescription
            ? accommodation.description.slice(0, 100) + '…'
            : accommodation.description}
        </p>
        {accommodation.status === '운영 중지' && <p className="catalog-status">운영 중지</p>}
        {accommodation.amenities.length > 0 && (
          <ul className="catalog-amenities" aria-label="숙소 편의시설">
            {accommodation.amenities.map((amenity) => (
              <li key={amenity}>{amenity}</li>
            ))}
          </ul>
        )}
        <details className="catalog-more">
          <summary>소개·주소 더 보기</summary>
          {longDescription && <p>{accommodation.description}</p>}
          <p>상세 주소 · {accommodation.address}</p>
        </details>
        <div className="catalog-card-action">
          <Link
            id={`accommodation-rooms-link-${accommodation.id}`}
            to={detailPath}
            onClick={remember}
            aria-label={`${accommodation.name} 객실 보기`}
          >
            객실 보기 ↗
          </Link>
        </div>
      </div>
    </article>
  )
}
