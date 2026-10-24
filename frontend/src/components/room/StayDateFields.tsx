import { useRef, useState } from 'react'
import { StayDateCalendar } from './StayDateCalendar'
import { changeStayCheckIn, stayNights, type StayDates, type StayDateField } from './stayDateRange'

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
  const [notice, setNotice] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const calendarId = `${prefix}-calendar`
  const nights = stayNights(draft)
  function close() {
    setOpen(false)
    trigger.current?.focus()
  }
  function apply(dates: StayDates) {
    for (const field of ['checkInDate', 'checkOutDate'] as const) {
      if (dates[field] !== draft[field]) onChange(field, dates[field])
    }
  }
  return (
    <div className="stay-date-range" role="group" aria-label={`${labelPrefix || '숙박'} 날짜 범위`}>
      <div className="stay-date-inputs">
        {(['checkInDate', 'checkOutDate'] as const).map((field, index) => (
          <div className="form-field" key={field}>
            <label htmlFor={`${prefix}-${field}`}>
              {`${labelPrefix} ${['체크인', '체크아웃'][index]}`.trim()}
            </label>
            <input
              id={`${prefix}-${field}`}
              type="date"
              name={field}
              required={required}
              min="0001-01-01"
              max="9999-12-31"
              aria-describedby={`${prefix}-date-help`}
              value={draft[field]}
              onChange={(event) => {
                setOpen(false)
                if (field === 'checkInDate') {
                  const next = changeStayCheckIn(draft, event.target.value)
                  apply(next.dates)
                  setNotice(next.notice)
                } else {
                  onChange(field, event.target.value)
                  setNotice('')
                }
              }}
            />
          </div>
        ))}
      </div>
      <p className="stay-date-summary">
        {nights === null
          ? '숙박 기간 미선택 · 최소 1박'
          : `체크인 ${draft.checkInDate} ~ 체크아웃 ${draft.checkOutDate} · ${nights}박`}
      </p>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={calendarId}
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
      >
        날짜 달력 {open ? '닫기' : '열기'}
      </button>
      {notice && <p role="status">{notice}</p>}
      <p id={`${prefix}-date-help`} className="stay-date-help">
        숙박 날짜는 [체크인, 체크아웃) 기준입니다. 숙소별 최소/최대 숙박일·사전 예약 제한은 조회
        API가 없어 미리 적용하지 않으며 서버가 최종 검증합니다.
      </p>
      {open && (
        <StayDateCalendar
          id={calendarId}
          initial={draft}
          onCancel={close}
          onApply={(dates) => {
            apply(dates)
            setNotice('달력의 숙박 기간을 적용했습니다. 조건을 확인한 뒤 조회하세요.')
            close()
          }}
        />
      )}
    </div>
  )
}
