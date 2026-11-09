import { StayDateFields } from './StayDateFields'
import {
  DestinationCombobox,
  type DestinationComboboxOptions,
} from '../accommodation/DestinationCombobox'
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
  city?: DestinationComboboxOptions
  required?: boolean
  actionLabel: string
  error?: string
}) {
  return (
    <div className={`compact-search-bar${city ? ' compact-search-with-city' : ''}`}>
      {city && <DestinationCombobox id={`${prefix}-city`} {...city} />}
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
