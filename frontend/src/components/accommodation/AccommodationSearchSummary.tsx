import type { AccommodationSearchQuery } from './searchQuery'

// Submitted URL projection only. Never present form drafts as the results' search conditions.
export function AccommodationSearchSummary({ query }: { query: AccommodationSearchQuery }) {
  return (
    <div className="search-applied-summary" role="region" aria-label="적용된 검색 조건">
      <p>조회 기준 · 변경 사항은 검색 후 반영</p>
      <p className="search-applied-values">
        <span>{[query.city, query.region].filter(Boolean).join(' · ') || '전체 지역'}</span>
        <span>
          {query.checkInDate ? `${query.checkInDate} → ${query.checkOutDate}` : '날짜 미지정'}
        </span>
        <span>{query.guestCount === undefined ? '인원 미지정' : `${query.guestCount}명`}</span>
        <span>
          {query.sortBy === 'NAME' ? '이름순' : '등록순'} ·{' '}
          {query.direction === 'ASC' ? '오름차순' : '내림차순'}
        </span>
      </p>
    </div>
  )
}
