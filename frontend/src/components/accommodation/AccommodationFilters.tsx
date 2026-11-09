import { accommodationAmenities, roomAmenities } from '../../api/accommodation'
import { amenityLabels } from './accommodationView'
import type { AccommodationSearchQuery } from './searchQuery'

export function AccommodationFilters({
  draft,
  onChange,
}: {
  draft: AccommodationSearchQuery
  onChange: (query: AccommodationSearchQuery) => void
}) {
  return (
    <div className="search-filter-grid">
      {(['name', 'region'] as const)
        .filter((key) => key === 'name' || (!draft.country && !draft.destination))
        .map((key) => (
          <div className="form-field" key={key}>
            <label htmlFor={`filter-${key}`}>{key === 'name' ? '숙소명' : '지역'}</label>
            <input
              id={`filter-${key}`}
              maxLength={100}
              value={draft[key] ?? ''}
              onChange={(event) => onChange({ ...draft, [key]: event.target.value || undefined })}
            />
          </div>
        ))}
      <fieldset>
        <legend>기본 1박 가격</legend>
        <p className="search-filter-help">
          활성 객실의 기본 가격 기준이며 날짜별 요금·숙박 총액이 아닙니다.
        </p>
        {(['minPrice', 'maxPrice'] as const).map((key, index) => (
          <div className="form-field" key={key}>
            <label htmlFor={`filter-${key}`}>
              {['최소 기본 1박 가격', '최대 기본 1박 가격'][index]}
            </label>
            <input
              id={`filter-${key}`}
              type="number"
              min="0"
              step="any"
              value={draft[key] ?? ''}
              onChange={(event) => onChange({ ...draft, [key]: event.target.value || undefined })}
            />
          </div>
        ))}
      </fieldset>
      <div className="form-field">
        <label htmlFor="filter-available">기간 내 예약 가능 여부</label>
        <select
          id="filter-available"
          value={draft.available === undefined ? '' : String(draft.available)}
          onChange={(event) =>
            onChange({
              ...draft,
              available: event.target.value === '' ? undefined : event.target.value === 'true',
            })
          }
        >
          <option value="">날짜 입력 시 예약 가능</option>
          <option value="true">예약 가능</option>
          <option value="false">예약 불가</option>
        </select>
      </div>
      <fieldset>
        <legend>숙소 편의시설 (모두 포함)</legend>
        {accommodationAmenities.map((key) => (
          <label className="amenity-option" key={key}>
            <input
              type="checkbox"
              checked={draft.accommodationAmenities?.includes(key) ?? false}
              onChange={(event) =>
                onChange({
                  ...draft,
                  accommodationAmenities: event.target.checked
                    ? [...(draft.accommodationAmenities ?? []), key]
                    : draft.accommodationAmenities?.filter((item) => item !== key),
                })
              }
            />
            {amenityLabels[key]}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>객실 편의시설 (한 활성 객실에 모두 포함)</legend>
        {roomAmenities.map((key) => (
          <label className="amenity-option" key={key}>
            <input
              type="checkbox"
              checked={draft.roomAmenities?.includes(key) ?? false}
              onChange={(event) =>
                onChange({
                  ...draft,
                  roomAmenities: event.target.checked
                    ? [...(draft.roomAmenities ?? []), key]
                    : draft.roomAmenities?.filter((item) => item !== key),
                })
              }
            />
            {key === 'WIFI' ? '와이파이' : '에어컨'}
          </label>
        ))}
      </fieldset>
      <details className="search-extra-settings">
        <summary>추가 조회 설정</summary>
        <p className="search-filter-help">
          공유된 기존 검색 링크의 운영 상태·표시 개수도 유지합니다.
        </p>
        <div className="form-field">
          <label htmlFor="filter-status">운영 상태</label>
          <select
            id="filter-status"
            value={draft.status ?? 'ACTIVE'}
            onChange={(event) =>
              onChange({ ...draft, status: event.target.value as 'ACTIVE' | 'INACTIVE' })
            }
          >
            <option value="ACTIVE">운영 중</option>
            <option value="INACTIVE">운영 중지</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="filter-size">페이지 크기</label>
          <input
            id="filter-size"
            type="number"
            min="1"
            max="100"
            step="1"
            value={draft.size}
            onChange={(event) => onChange({ ...draft, size: Number(event.target.value) })}
          />
        </div>
      </details>
    </div>
  )
}
