import { useState, type FormEvent } from 'react'
import type { AccommodationSearchRequest } from '../../api/accommodation'
import { accommodationAmenities, roomAmenities } from '../../api/accommodation'
import { amenityLabels } from './accommodationView'
import { parseSearchQuery, type AccommodationSearchQuery } from './searchQuery'

export function AccommodationSearchForm({
  onSearch,
  initialQuery,
}: {
  onSearch: (request: AccommodationSearchRequest) => void
  initialQuery: AccommodationSearchQuery
}) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const params = new URLSearchParams()
    for (const [key, value] of data) {
      const text = String(value).trim()
      if (text) params.append(key, text)
    }
    params.set('page', '0')
    const parsed = parseSearchQuery(params)
    if (!parsed.valid) {
      setError(parsed.message)
      return
    }
    setError('')
    onSearch(parsed.query)
  }
  return (
    <form className="accommodation-search-form" onSubmit={submit} aria-label="숙소 검색 조건">
      {(['city'] as const).map((name) => (
        <div className="form-field" key={name}>
          <label htmlFor={`search-${name}`}>도시 (정확한 이름)</label>
          <input
            id={`search-${name}`}
            name={name}
            maxLength={100}
            defaultValue={initialQuery[name]}
          />
        </div>
      ))}
      {(['checkInDate', 'checkOutDate'] as const).map((name, index) => (
        <div className="form-field" key={name}>
          <label htmlFor={`search-${name}`}>{['체크인', '체크아웃'][index]}</label>
          <input id={`search-${name}`} name={name} type="date" defaultValue={initialQuery[name]} />
        </div>
      ))}
      <div className="form-field">
        <label htmlFor="search-guests">인원</label>
        <input
          id="search-guests"
          name="guestCount"
          type="number"
          min="1"
          max="2147483647"
          step="1"
          defaultValue={initialQuery.guestCount}
        />
      </div>
      <details
        className="search-filters"
        open={Boolean(
          initialQuery.name ||
          initialQuery.region ||
          initialQuery.minPrice ||
          initialQuery.maxPrice ||
          initialQuery.accommodationAmenities?.length ||
          initialQuery.roomAmenities?.length,
        )}
      >
        <summary>편의시설 · 가격 · 정렬 필터</summary>
        <div className="search-filter-grid">
          {(['name', 'region'] as const).map((name, index) => (
            <div className="form-field" key={name}>
              <label htmlFor={`search-${name}`}>{['숙소명', '지역'][index]}</label>
              <input
                id={`search-${name}`}
                name={name}
                maxLength={100}
                defaultValue={initialQuery[name]}
              />
            </div>
          ))}
          {(['minPrice', 'maxPrice'] as const).map((name, index) => (
            <div className="form-field" key={name}>
              <label htmlFor={`search-${name}`}>
                {['최소 기본 1박 가격', '최대 기본 1박 가격'][index]}
              </label>
              <input
                id={`search-${name}`}
                name={name}
                type="number"
                min="0"
                step="any"
                defaultValue={initialQuery[name]}
              />
            </div>
          ))}
          <div className="form-field">
            <label htmlFor="search-sort">정렬</label>
            <select id="search-sort" name="sortBy" defaultValue={initialQuery.sortBy}>
              <option value="ID">등록순</option>
              <option value="NAME">이름순</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="search-direction">정렬 방향</label>
            <select id="search-direction" name="direction" defaultValue={initialQuery.direction}>
              <option value="ASC">오름차순</option>
              <option value="DESC">내림차순</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="search-status">운영 상태</label>
            <select id="search-status" name="status" defaultValue={initialQuery.status}>
              <option value="ACTIVE">운영 중</option>
              <option value="INACTIVE">운영 중지</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="search-available">기간 내 예약 가능 여부</label>
            <select
              id="search-available"
              name="available"
              defaultValue={
                initialQuery.available === undefined ? '' : String(initialQuery.available)
              }
            >
              <option value="">기본 (날짜 입력 시 예약 가능)</option>
              <option value="true">예약 가능</option>
              <option value="false">예약 불가</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="search-size">페이지 크기</label>
            <input
              id="search-size"
              name="size"
              type="number"
              min="1"
              max="100"
              step="1"
              required
              defaultValue={initialQuery.size}
            />
          </div>
          <fieldset>
            <legend>숙소 편의시설 (모두 포함)</legend>
            {accommodationAmenities.map((amenity) => (
              <label className="amenity-option" key={amenity}>
                <input
                  type="checkbox"
                  name="accommodationAmenities"
                  value={amenity}
                  defaultChecked={initialQuery.accommodationAmenities?.includes(amenity)}
                />
                {amenityLabels[amenity]}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>객실 편의시설 (한 활성 객실에 모두 포함)</legend>
            {roomAmenities.map((amenity) => (
              <label className="amenity-option" key={amenity}>
                <input
                  type="checkbox"
                  name="roomAmenities"
                  value={amenity}
                  defaultChecked={initialQuery.roomAmenities?.includes(amenity)}
                />
                {amenity === 'WIFI' ? '와이파이' : '에어컨'}
              </label>
            ))}
          </fieldset>
        </div>
      </details>
      <button type="submit">검색</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
