import type { AccommodationSearchQuery } from './searchQuery'

// Submitted URL projection only. Never present form drafts as the results' search conditions.
export function AccommodationSearchSummary({ query }: { query: AccommodationSearchQuery }) {
  return (
    <div className="search-applied-summary">
      <p>적용된 검색 조건 · 변경한 입력은 검색 또는 조건 적용 후 반영됩니다.</p>
      <dl aria-label="적용된 검색 조건">
        <div>
          <dt>여행지</dt>
          <dd>{[query.city, query.region].filter(Boolean).join(' · ') || '전체 지역'}</dd>
        </div>
        <div>
          <dt>숙박 기간</dt>
          <dd>
            {query.checkInDate ? `${query.checkInDate} → ${query.checkOutDate}` : '날짜 미지정'}
          </dd>
        </div>
        <div>
          <dt>전체 인원</dt>
          <dd>{query.guestCount === undefined ? '인원 미지정' : `${query.guestCount}명`}</dd>
        </div>
        <div>
          <dt>조회 정렬</dt>
          <dd>
            {query.sortBy === 'NAME' ? '이름순' : '등록순'} ·{' '}
            {query.direction === 'ASC' ? '오름차순' : '내림차순'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
