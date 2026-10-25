import { AccommodationCard } from './AccommodationCard'
import type { AccommodationCardModel } from './accommodationView'
import { EmptyState } from '../ui/EmptyState'

export function AccommodationList({
  accommodations,
}: {
  accommodations: AccommodationCardModel[]
}) {
  if (!accommodations.length) return <EmptyState message="검색 조건에 맞는 숙소가 없습니다." />
  return (
    <ul className="accommodation-list" aria-label="숙소 목록">
      {accommodations.map((accommodation) => (
        <li key={accommodation.id}>
          <AccommodationCard accommodation={accommodation} />
        </li>
      ))}
    </ul>
  )
}
