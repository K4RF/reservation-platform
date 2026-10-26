import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { isCalendarDate } from '../../utils/calendarDate'
import { validateAvailability } from '../../api/availabilityValidation'
import {
  addStayDays,
  changeStayCheckIn,
  monthDays,
  shiftStayMonth,
  stayNights,
  type StayDates,
  type StayDateField,
} from './stayDateRange'

// Non-modal, inline disclosure: normal Tab order stays available; no overlay, focus trap or scroll lock.
export function StayDateCalendar({
  id,
  initial,
  onApply,
  onCancel,
}: {
  id: string
  initial: StayDates
  onApply: (dates: StayDates) => void
  onCancel: () => void
}) {
  const seed = isCalendarDate(initial.checkInDate)
    ? initial.checkInDate
    : new Date().toISOString().slice(0, 10)
  const [dates, setDates] = useState(initial)
  const [field, setField] = useState<StayDateField>('checkInDate')
  const [month, setMonth] = useState(seed.slice(0, 7))
  const [focusDate, setFocusDate] = useState(seed)
  const [notice, setNotice] = useState(
    '체크인을 먼저 선택하세요. 달력 선택은 적용 전까지 반영되지 않습니다.',
  )
  const grid = useRef<HTMLTableElement>(null)
  const moveFocus = useRef(true)
  useEffect(() => {
    if (moveFocus.current) {
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus()
      moveFocus.current = false
    }
  }, [focusDate, month])
  const nights = stayNights(dates)
  // This component validates dates only. Real guest count is still validated by the parent on submit.
  const error = validateAvailability({ ...dates, guestCount: 1 })
  function focus(value: string) {
    if (value === focusDate && month === value.slice(0, 7)) return
    moveFocus.current = true
    setFocusDate(value)
    setMonth(value.slice(0, 7))
  }
  function choose(date: string) {
    setFocusDate(date)
    if (field === 'checkInDate') {
      const next = changeStayCheckIn(dates, date)
      setDates(next.dates)
      setField('checkOutDate')
      setNotice(`${next.notice} 체크아웃을 선택하세요.`)
    } else if (!isCalendarDate(dates.checkInDate) || date <= dates.checkInDate) {
      setNotice(
        '체크아웃은 체크인보다 늦어야 합니다. 다른 날짜를 고르거나 체크인 선택으로 돌아가세요.',
      )
    } else {
      setDates({ ...dates, checkOutDate: date })
      setNotice(
        '숙박 범위를 확인한 뒤 날짜 적용을 누르세요. 아직 조회나 예약 요청은 보내지 않았습니다.',
      )
    }
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -new Date(`${date}T00:00:00Z`).getUTCDay(),
      End: 6 - new Date(`${date}T00:00:00Z`).getUTCDay(),
    }
    let next: string | null = null
    if (event.key in offsets) next = addStayDays(date, offsets[event.key])
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const target = shiftStayMonth(date.slice(0, 7), event.key === 'PageUp' ? -1 : 1)
      if (target) {
        const days = monthDays(target)
          .flat()
          .filter((day): day is string => day !== null)
        next = days[Math.min(Number(date.slice(-2)), days.length) - 1]
      }
    } else return
    event.preventDefault()
    if (next) focus(next)
  }
  function monthChange(value: string) {
    if (isCalendarDate(`${value}-01`)) {
      setMonth(value)
      setFocusDate(`${value}-01`)
    }
  }
  return (
    <div
      id={id}
      className="stay-calendar"
      role="region"
      aria-label="숙박 날짜 달력"
      onKeyDown={(event) => {
        // Editing the display month must not implicitly submit the surrounding search/booking form.
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement)
          event.preventDefault()
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        }
      }}
    >
      <div className="action-group">
        <button
          type="button"
          aria-pressed={field === 'checkInDate'}
          onClick={() => setField('checkInDate')}
        >
          체크인 선택
        </button>
        <button
          type="button"
          aria-pressed={field === 'checkOutDate'}
          disabled={!isCalendarDate(dates.checkInDate)}
          onClick={() => setField('checkOutDate')}
        >
          체크아웃 선택
        </button>
      </div>
      <p role="status" aria-live="polite">
        {notice}
      </p>
      <div className="stay-calendar-month">
        <button
          type="button"
          aria-label="이전 달"
          disabled={!shiftStayMonth(month, -1)}
          onClick={() => monthChange(shiftStayMonth(month, -1)!)}
        >
          이전
        </button>
        <div className="form-field">
          <label htmlFor={`${id}-month`}>달력 표시 월</label>
          <input
            id={`${id}-month`}
            type="month"
            min="0001-01"
            max="9999-12"
            value={month}
            onChange={(event) => monthChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          aria-label="다음 달"
          disabled={!shiftStayMonth(month, 1)}
          onClick={() => monthChange(shiftStayMonth(month, 1)!)}
        >
          다음
        </button>
      </div>
      <p id={`${id}-keys`} className="stay-date-help">
        방향키: 날짜 이동 · Home/End: 주 처음/끝 · PageUp/PageDown: 월 이동 · Enter/Space: 선택 ·
        Escape: 취소. 직접 날짜 입력도 가능합니다.
      </p>
      <div className="stay-calendar-scroll" role="region" aria-label="숙박 날짜 표" tabIndex={0}>
        <table
          ref={grid}
          role="grid"
          aria-multiselectable="true"
          aria-label={`${month} 숙박 날짜`}
          aria-describedby={`${id}-keys`}
          className="stay-calendar-grid"
        >
          <thead>
            <tr>
              {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                <th key={day} scope="col">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthDays(month).map((week, i) => (
              <tr key={i}>
                {week.map((date, j) => {
                  const boundary =
                    date === dates.checkInDate
                      ? '체크인'
                      : date === dates.checkOutDate
                        ? '체크아웃'
                        : ''
                  const selected =
                    date !== null &&
                    nights !== null &&
                    date >= dates.checkInDate &&
                    date <= dates.checkOutDate
                  return (
                    <td
                      key={j}
                      role="gridcell"
                      aria-selected={date === null ? undefined : Boolean(selected)}
                      className={boundary ? 'stay-date-boundary' : undefined}
                    >
                      {date && (
                        <button
                          type="button"
                          data-date={date}
                          aria-label={`${date}${boundary ? ` ${boundary}` : ''}`}
                          tabIndex={date === focusDate ? 0 : -1}
                          onFocus={() => setFocusDate(date)}
                          onKeyDown={(event) => key(event, date)}
                          onClick={() => choose(date)}
                        >
                          {Number(date.slice(-2))}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="stay-date-summary">
        선택 중: 체크인 {dates.checkInDate || '미선택'} ~ 체크아웃 {dates.checkOutDate || '미선택'}
        {nights !== null ? ` · ${nights}박` : ' · 최소 1박 필요'}
      </p>
      <div className="action-group">
        <button
          type="button"
          className="primary-action"
          disabled={Boolean(error)}
          onClick={() => {
            if (!error) onApply(dates)
          }}
        >
          날짜 적용
        </button>
        <button type="button" onClick={onCancel}>
          날짜 선택 취소
        </button>
      </div>
    </div>
  )
}
