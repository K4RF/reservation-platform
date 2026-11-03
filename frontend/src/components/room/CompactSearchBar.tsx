import { StayDateFields } from './StayDateFields'
import { GuestCountPicker } from './GuestCountPicker'
import type { StayDates, StayDateField } from './stayDateRange'

/** Controls only, never a nested form or an availability/mutation state owner. */
export function CompactSearchBar({
  prefix,
  dates,
  onDateChange,
  guestCount,
  onGuestChange,
  city,
  required = true,
  actionLabel,
  error,
}: {
  prefix: string
  dates: StayDates
  onDateChange: (field: StayDateField, value: string) => void
  guestCount: string
  onGuestChange: (value: string) => void
  city?: { initial?: string; onChange?: (value: string) => void }
  required?: boolean
  actionLabel: string
  error?: string
}) {
  return (
    <div className={`compact-search-bar${city ? ' compact-search-with-city' : ''}`}>
      {city && (
        <div className="compact-city-field form-field">
          <label htmlFor={`${prefix}-city`}>여행지 · 도시명</label>
          <input
            id={`${prefix}-city`}
            name="city"
            maxLength={100}
            defaultValue={city.initial}
            onChange={(event) => city.onChange?.(event.target.value)}
            placeholder="도시 이름"
            aria-describedby={`${prefix}-city-help`}
          />
          <span className="sr-only" id={`${prefix}-city-help`}>
            도시의 정확한 이름으로 검색합니다.
          </span>
        </div>
      )}
      <StayDateFields
        prefix={prefix}
        labelPrefix={city ? '' : '숙박'}
        required={required}
        draft={dates}
        onChange={onDateChange}
      />
      <GuestCountPicker
        id={`${prefix}-guests`}
        label={city ? '인원' : '숙박 인원'}
        required={required}
        value={guestCount}
        onChange={onGuestChange}
      />
      <button type="submit" className="compact-search-submit">
        {actionLabel}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
