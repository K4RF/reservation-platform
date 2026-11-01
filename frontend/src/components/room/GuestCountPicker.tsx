import { useCallback, useRef, useState, type RefObject } from 'react'
import { isValidGuestCount } from '../../api/availabilityValidation'
import { GuestCountField } from './GuestCountField'
import { SearchLayer } from './SearchLayer'
import { useWideSearchLayer } from './useWideSearchLayer'

function GuestEditor({
  id,
  initial,
  label,
  required,
  onApply,
  onCancel,
  anchor,
}: {
  id: string
  initial: string
  label: string
  required: boolean
  onApply: (value: string) => void
  onCancel: () => void
  anchor: RefObject<HTMLButtonElement | null>
}) {
  const [draft, setDraft] = useState(initial)
  const wide = useWideSearchLayer()
  const valid = draft === '' ? !required : /^\d+$/.test(draft) && isValidGuestCount(Number(draft))
  return (
    <SearchLayer
      id={`${id}-layer`}
      title="몇 명이 함께하시나요?"
      modal={!wide}
      anchor={anchor}
      onClose={onCancel}
    >
      <GuestCountField
        id={`${id}-draft`}
        label={label}
        value={draft}
        onChange={setDraft}
        required={required}
      />
      <div className="search-layer-actions">
        <button type="button" onClick={onCancel}>
          인원 선택 취소
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={!valid}
          onClick={() => {
            if (valid) onApply(draft)
          }}
        >
          인원 적용
        </button>
      </div>
    </SearchLayer>
  )
}
export function GuestCountPicker({
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
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const summary =
    value === ''
      ? required
        ? '인원 선택'
        : '인원 조건 없음'
      : /^\d+$/.test(value) && isValidGuestCount(Number(value))
        ? `총 ${Number(value)}명`
        : '인원 확인 필요'
  return (
    <div className="guest-count-picker">
      <input type="hidden" name="guestCount" value={value} />
      <button
        ref={trigger}
        className="compact-search-trigger"
        type="button"
        aria-label={`${label} 선택`}
        aria-describedby={`${id}-summary`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? `${id}-layer` : undefined}
        onClick={() => setOpen(true)}
      >
        <span className="compact-search-caption">숙박 인원</span>
        <span id={`${id}-summary`}>{summary}</span>
      </button>
      {open && (
        <GuestEditor
          anchor={trigger}
          id={id}
          label={label}
          initial={value}
          required={required}
          onCancel={close}
          onApply={(next) => {
            if (next !== value) onChange(next)
            close()
          }}
        />
      )}
    </div>
  )
}
