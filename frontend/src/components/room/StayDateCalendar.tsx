import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { isCalendarDate } from '../../utils/calendarDate'
import { validateAvailability } from '../../api/availabilityValidation'
import { useWideSearchLayer } from './useWideSearchLayer'
import {
  addStayDays,
  changeStayCheckIn,
  monthDays,
  shiftStayMonth,
  stayNights,
  type StayDates,
  type StayDateField,
} from './stayDateRange'

// Local editor only. SearchLayer owns modality and the parent owns committed conditions.
export function StayDateCalendar({
  id,
  initial,
  onApply,
  onCancel,
  labelPrefix = '숙박',
  required = true,
}: {
  id: string
  initial: StayDates
  onApply: (dates: StayDates) => void
  onCancel: () => void
  labelPrefix?: string
  required?: boolean
}) {
  const seed = isCalendarDate(initial.checkInDate)
    ? initial.checkInDate
    : new Date().toISOString().slice(0, 10)
  const [dates, setDates] = useState(initial)
  const [field, setField] = useState<StayDateField>('checkInDate')
  const [calendarMonth, setMonth] = useState(seed.slice(0, 7))
  const [focusDate, setFocusDate] = useState(seed)
  const [notice, setNotice] = useState('체크인을 먼저 선택하세요. 최소 1박입니다.')
  const [directTouched, setDirectTouched] = useState(false)
  const wide = useWideSearchLayer()
  // Retain the keyed focused month when two columns become one, including a second-month click.
  const month = wide ? calendarMonth : focusDate.slice(0, 7)
  const grid = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(true)
  useEffect(() => {
    if (moveFocus.current) {
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus()
      moveFocus.current = false
    }
  }, [focusDate, month])
  const nights = stayNights(dates)
  // This component validates dates only. Real guest count is still validated by the parent on submit.
  const error =
    !required && !dates.checkInDate && !dates.checkOutDate
      ? null
      : validateAvailability({ ...dates, guestCount: 1 })
  const secondMonth = wide ? shiftStayMonth(month, 1) : null
  const months = secondMonth ? [month, secondMonth] : [month]
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
      setNotice('숙박 범위를 확인한 뒤 날짜 적용을 누르세요.')
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
      <div className="stay-calendar-range-actions">
        <button
          type="button"
          aria-pressed={field === 'checkInDate'}
          aria-label="체크인 선택"
          onClick={() => setField('checkInDate')}
        >
          <span className="compact-search-caption">체크인</span>
          <span>{dates.checkInDate || '날짜 선택'}</span>
        </button>
        <button
          type="button"
          aria-pressed={field === 'checkOutDate'}
          aria-label="체크아웃 선택"
          disabled={!isCalendarDate(dates.checkInDate)}
          onClick={() => setField('checkOutDate')}
        >
          <span className="compact-search-caption">체크아웃</span>
          <span>{dates.checkOutDate || '날짜 선택'}</span>
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
          <label className="sr-only" htmlFor={`${id}-month`}>
            달력 표시 월
          </label>
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
      <div ref={grid} className="stay-calendar-months">
        {months.map((displayMonth) => (
          <div key={displayMonth}>
            <h3 className="stay-calendar-month-title">
              {displayMonth.slice(0, 4)}년 {Number(displayMonth.slice(5))}월
            </h3>
            <div
              className="stay-calendar-scroll"
              role="region"
              aria-label={`${displayMonth} 숙박 날짜 표`}
              tabIndex={0}
            >
              <table
                role="grid"
                aria-multiselectable="true"
                aria-label={`${displayMonth} 숙박 날짜`}
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
                  {monthDays(displayMonth).map((week, i) => (
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
          </div>
        ))}
      </div>
      <details className="stay-direct-entry">
        <summary>날짜 직접 입력</summary>
        <div className="stay-date-inputs">
          {(['checkInDate', 'checkOutDate'] as const).map((name, index) => (
            <div className="form-field" key={name}>
              <label htmlFor={`${id}-${name}`}>
                {`${labelPrefix} ${index ? '체크아웃' : '체크인'}`.trim()}
              </label>
              <input
                id={`${id}-${name}`}
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={dates[name]}
                aria-describedby={`${id}-summary`}
                onChange={(event) => {
                  const value = event.target.value
                  setDirectTouched(true)
                  if (name === 'checkInDate') {
                    const next = changeStayCheckIn(dates, value)
                    setDates(next.dates)
                    setNotice(next.notice)
                  } else {
                    setDates({ ...dates, checkOutDate: value })
                    setNotice('')
                  }
                  if (isCalendarDate(value)) {
                    setMonth(value.slice(0, 7))
                    setFocusDate(value)
                  }
                }}
              />
            </div>
          ))}
        </div>
        {directTouched && error && <p role="alert">{error}</p>}
        <p id={`${id}-keys`} className="stay-date-help">
          방향키: 날짜 이동 · Home/End: 주 처음/끝 · PageUp/PageDown: 월 이동 · Enter/Space: 선택 ·
          Escape: 취소. 직접 날짜 입력도 가능합니다.
        </p>
      </details>
      <p className="stay-date-summary" id={`${id}-summary`}>
        {!dates.checkInDate && !dates.checkOutDate ? (
          '최소 1박, 날짜를 선택해 주세요.'
        ) : (
          <>
            선택 중: 체크인 {dates.checkInDate || '미선택'} ~ 체크아웃{' '}
            {dates.checkOutDate || '미선택'}
            {nights !== null ? ` · ${nights}박` : ' · 최소 1박 필요'}
          </>
        )}
      </p>
      <div className="search-layer-actions">
        {!required && (
          <button
            type="button"
            aria-label="날짜 지우기"
            onClick={() => {
              setDates({ checkInDate: '', checkOutDate: '' })
              setNotice('날짜 없이 숙소를 둘러볼 수 있습니다.')
              setDirectTouched(false)
            }}
          >
            지우기
          </button>
        )}
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
        <button type="button" aria-label="날짜 선택 취소" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}
