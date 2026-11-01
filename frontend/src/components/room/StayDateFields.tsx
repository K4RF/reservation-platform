import { useCallback, useRef, useState } from 'react'
import { StayDateCalendar } from './StayDateCalendar'
import { SearchLayer } from './SearchLayer'
import { stayNights, type StayDates, type StayDateField } from './stayDateRange'

export function StayDateFields({
  prefix,
  labelPrefix = '숙박',
  draft,
  onChange,
  required = true,
}: {
  prefix: string
  labelPrefix?: string
  draft: StayDates
  onChange: (field: StayDateField, value: string) => void
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const nights = stayNights(draft)
  const sameYear = draft.checkInDate.slice(0, 4) === draft.checkOutDate.slice(0, 4)
  const displayDate = (date: string) => (sameYear ? date.slice(5) : date).replaceAll('-', '.')
  const id = `${prefix}-calendar`
  return (
    <div className="stay-date-range">
      {/* Serialization only: validation belongs to the visible editor and the submitting parser. */}
      <input type="hidden" name="checkInDate" value={draft.checkInDate} />
      <input type="hidden" name="checkOutDate" value={draft.checkOutDate} />
      <button
        className="compact-search-trigger"
        ref={trigger}
        type="button"
        aria-label={`${labelPrefix || '숙박'} 날짜 선택`}
        aria-describedby={`${prefix}-date-detail`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(true)}
      >
        <span className="compact-search-caption">체크인 — 체크아웃</span>
        <span id={`${prefix}-date-summary`}>
          {nights === null
            ? draft.checkInDate || draft.checkOutDate
              ? '날짜 확인 필요'
              : '날짜 선택'
            : `${displayDate(draft.checkInDate)} — ${displayDate(draft.checkOutDate)} · ${nights}박`}
        </span>
      </button>
      <span className="sr-only" id={`${prefix}-date-detail`}>
        {nights === null
          ? '날짜를 선택하거나 확인해 주세요.'
          : `체크인 ${draft.checkInDate}, 체크아웃 ${draft.checkOutDate}, ${nights}박`}
      </span>
      {open && (
        <SearchLayer id={id} title="언제 머무르시나요?" anchor={trigger} onClose={close}>
          <StayDateCalendar
            id={`${id}-editor`}
            initial={draft}
            labelPrefix={labelPrefix}
            required={required}
            onCancel={close}
            onApply={(dates) => {
              for (const field of ['checkInDate', 'checkOutDate'] as const)
                if (dates[field] !== draft[field]) onChange(field, dates[field])
              close()
            }}
          />
        </SearchLayer>
      )}
    </div>
  )
}
