import { useRef } from 'react'
import { isValidGuestCount, MAX_GUEST_COUNT } from '../../api/availabilityValidation'

/** Keep the raw draft (including empty/invalid input); callers own submission and invalidation. */
export function GuestCountField({
  id,
  label = '숙박 인원',
  value,
  onChange,
  required = true,
}: {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const count = Number(value)
  const empty = value === ''
  const valid = !empty && isValidGuestCount(count)
  const invalid = !valid && (!empty || required)
  function step(next: number) {
    onChange(String(next))
    // A newly disabled native button drops keyboard focus; retain it within the control.
    if (next === 1 || next === MAX_GUEST_COUNT) input.current?.focus()
  }
  return (
    <div className="form-field guest-count-field">
      <label htmlFor={id}>{label}</label>
      <div className="guest-count-controls">
        <button
          type="button"
          aria-label={`${label} 1명 줄이기`}
          aria-controls={id}
          disabled={!valid || count <= 1}
          onClick={() => step(count - 1)}
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          ref={input}
          id={id}
          name="guestCount"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_GUEST_COUNT}
          step={1}
          required={required}
          aria-invalid={invalid}
          aria-describedby={`${id}-help ${id}-summary`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={`${label} 1명 늘리기`}
          aria-controls={id}
          disabled={empty ? false : !valid || count >= MAX_GUEST_COUNT}
          onClick={() => step(empty ? 1 : count + 1)}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <span
        id={`${id}-summary`}
        className="guest-count-summary"
        aria-live="polite"
        aria-atomic="true"
      >
        {valid
          ? `전체 ${count}명`
          : invalid
            ? '1~2,147,483,647 사이의 정수를 입력하세요.'
            : '인원 조건 없음 · + 또는 직접 입력'}
      </span>
      <span id={`${id}-help`} className="guest-count-help">
        성인·아동을 합한 전체 인원입니다. 숫자 직접 입력이 가능하며 정원은 객실별로 확인하세요.
      </span>
    </div>
  )
}
