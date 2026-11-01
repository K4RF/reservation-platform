import { useState } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StayDateFields } from './StayDateFields'
import type { StayDates } from './stayDateRange'
import { committedDates, openDates } from '../../test/searchLayers'

const initial = { checkInDate: '2030-01-01', checkOutDate: '2030-01-03' }
const trigger = () => screen.getByRole('button', { name: '숙박 날짜 선택' })
const panel = () => screen.getByRole('region', { name: '숙박 날짜 달력' })
const date = (value: string) =>
  within(panel()).getByRole('button', { name: new RegExp(`^${value}( |$)`) })
const committed = () => committedDates(screen.getByRole('form', { name: 'test' }))
function direct() {
  fireEvent.click(screen.getByText('날짜 직접 입력', { selector: 'summary' }))
}
function Harness({
  start = initial,
  onChange = vi.fn(),
  onSubmit = vi.fn(),
  required = true,
}: {
  start?: StayDates
  onChange?: (field: string, value: string) => void
  onSubmit?: () => void
  required?: boolean
}) {
  const [draft, setDraft] = useState(start)
  return (
    <form
      aria-label="test"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <StayDateFields
        prefix="test"
        draft={draft}
        required={required}
        onChange={(field, value) => {
          onChange(field, value)
          setDraft((current) => ({ ...current, [field]: value }))
        }}
      />
    </form>
  )
}

describe('staged stay range dialog and keyboard calendar', () => {
  it('preserves the focused second month and its one tab stop when resizing to one column', () => {
    const media = Object.assign(new EventTarget(), { matches: true })
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    )
    render(<Harness />)
    openDates()
    expect(screen.getAllByRole('grid')).toHaveLength(2)
    const target = date('2030-02-04')
    target.focus()
    fireEvent.click(target)
    act(() => {
      media.matches = false
      media.dispatchEvent(new Event('change'))
    })
    expect(screen.getAllByRole('grid')).toHaveLength(1)
    expect(screen.getByRole('grid').getAttribute('aria-label')).toBe('2030-02 숙박 날짜')
    expect(date('2030-02-04').tabIndex).toBe(0)
    expect(screen.getByLabelText('달력 표시 월')).toHaveProperty('value', '2030-02')
    expect(committed()).toEqual(initial)
  })
  it('shows one closed summary, with no invisible native required validation or duplicate form values', () => {
    render(<Harness />)
    expect(screen.queryByLabelText('숙박 체크인')).toBeNull()
    expect(trigger().textContent).toContain('01.01 — 01.03 · 2박')
    expect(committed()).toEqual(initial)
    const dialog = openDates()
    expect(dialog.closest('form')).toBeNull()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(committed()).toEqual(initial)
    expect(document.querySelectorAll('form')).toHaveLength(1)
  })
  it('keeps calendar preview separate; cancel/Escape discard changes and restore focus and scroll styles', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    trigger().focus()
    openDates()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(date('2030-01-10'))
    expect(committed()).toEqual(initial)
    fireEvent.click(screen.getByRole('button', { name: '날짜 선택 취소' }))
    expect(document.activeElement).toBe(trigger())
    expect(document.body.style.overflow).toBe('')
    openDates()
    fireEvent.click(date('2030-01-20'))
    fireEvent.keyDown(date('2030-01-20'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger())
  })
  it('applies the full staged range only explicitly and never submits the surrounding form', () => {
    const onChange = vi.fn(),
      onSubmit = vi.fn()
    render(<Harness onChange={onChange} onSubmit={onSubmit} />)
    openDates()
    fireEvent.click(date('2030-01-10'))
    fireEvent.click(date('2030-01-12'))
    expect(onChange).not.toHaveBeenCalled()
    expect(date('2030-01-11').closest('td')?.getAttribute('aria-selected')).toBe('true')
    expect(within(panel()).getByText(/선택 중:.*2박/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
    expect(onChange.mock.calls).toEqual([
      ['checkInDate', '2030-01-10'],
      ['checkOutDate', '2030-01-12'],
    ])
    expect(committed().checkOutDate).toBe('2030-01-12')
    expect(onSubmit).not.toHaveBeenCalled()
  })
  it('retains later checkout and rejects same/earlier calendar checkout without reversing roles', () => {
    render(<Harness />)
    openDates()
    fireEvent.click(date('2030-01-02'))
    fireEvent.click(date('2030-01-02'))
    expect(within(panel()).getByRole('status').textContent).toContain('체크인보다 늦어야')
    fireEvent.click(date('2030-01-01'))
    expect(
      within(panel()).getByText(/선택 중: 체크인 2030-01-02 ~ 체크아웃 2030-01-03 · 1박/),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
    expect(committed().checkOutDate).toBe('2030-01-03')
  })
  it('stages direct input, normalizes check-in only, and refuses raw invalid checkout without changing committed conditions', () => {
    render(<Harness />)
    openDates()
    direct()
    fireEvent.change(screen.getByLabelText('숙박 체크인'), { target: { value: '2028-02-29' } })
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2030-01-03')
    fireEvent.change(screen.getByLabelText('숙박 체크인'), { target: { value: '2030-12-31' } })
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2031-01-01')
    expect(screen.getByRole('status').textContent).toContain('보정')
    fireEvent.change(screen.getByLabelText('숙박 체크아웃'), { target: { value: '2030-12-31' } })
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2030-12-31')
    expect(screen.getByRole('button', { name: '날짜 적용' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toContain('늦은 날짜')
    expect(committed()).toEqual(initial)
  })
  it('supports roving arrows, week/month keys, leap days, role switch and one grid tab stop', () => {
    render(<Harness start={{ checkInDate: '2028-02-28', checkOutDate: '2028-03-02' }} />)
    openDates()
    fireEvent.keyDown(date('2028-02-28'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(date('2028-02-29'))
    fireEvent.keyDown(date('2028-02-29'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(date('2028-03-01'))
    fireEvent.keyDown(date('2028-03-01'), { key: 'Home' })
    expect(document.activeElement).toBe(date('2028-02-27'))
    fireEvent.keyDown(date('2028-02-27'), { key: 'End' })
    expect(document.activeElement).toBe(date('2028-03-04'))
    fireEvent.keyDown(date('2028-03-04'), { key: 'PageUp' })
    expect(document.activeElement).toBe(date('2028-02-04'))
    fireEvent.keyDown(date('2028-02-04'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(date('2028-02-11'))
    fireEvent.keyDown(date('2028-02-11'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(date('2028-02-04'))
    fireEvent.change(screen.getByLabelText('달력 표시 월'), { target: { value: '2028-01' } })
    fireEvent.keyDown(date('2028-01-31'), { key: 'PageDown' })
    expect(document.activeElement).toBe(date('2028-02-29'))
    expect(
      within(screen.getByRole('grid'))
        .getAllByRole('button')
        .filter((b) => b.tabIndex === 0),
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '체크아웃 선택' }))
    expect(screen.getByRole('button', { name: '체크아웃 선택' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })
  it('handles year limits and invalid apply without inventing past-date restrictions', () => {
    render(<Harness start={{ checkInDate: '', checkOutDate: '' }} />)
    openDates()
    expect(screen.getByRole('button', { name: '날짜 적용' })).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('달력 표시 월'), { target: { value: '0001-01' } })
    expect(screen.getByRole('button', { name: '이전 달' })).toHaveProperty('disabled', true)
    fireEvent.click(date('0001-01-01'))
    expect(screen.getByRole('button', { name: '날짜 적용' })).toHaveProperty('disabled', false)
    fireEvent.click(screen.getByRole('button', { name: '체크인 선택' }))
    fireEvent.change(screen.getByLabelText('달력 표시 월'), { target: { value: '9999-12' } })
    expect(screen.getByRole('button', { name: '다음 달' })).toHaveProperty('disabled', true)
    fireEvent.click(date('9999-12-31'))
    expect(screen.getByRole('button', { name: '날짜 적용' })).toHaveProperty('disabled', true)
  })
  it('does not invalidate a query when applying unchanged dates and explicitly supports optional clearing', () => {
    const onChange = vi.fn()
    render(<Harness required={false} onChange={onChange} />)
    openDates()
    fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
    expect(onChange).not.toHaveBeenCalled()
    openDates()
    fireEvent.click(screen.getByRole('button', { name: '날짜 지우기' }))
    expect(committed()).toEqual(initial)
    fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
    expect(committed()).toEqual({ checkInDate: '', checkOutDate: '' })
  })
  it('does not implicitly submit from editor inputs or bypass a disabled fieldset', () => {
    const onSubmit = vi.fn()
    const view = render(<Harness onSubmit={onSubmit} />)
    openDates()
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    fireEvent(screen.getByLabelText('달력 표시 월'), event)
    expect(event.defaultPrevented).toBe(true)
    expect(onSubmit).not.toHaveBeenCalled()
    view.unmount()
    render(
      <fieldset disabled>
        <StayDateFields prefix="locked" draft={initial} onChange={vi.fn()} />
      </fieldset>,
    )
    expect(trigger().matches(':disabled')).toBe(true)
    expect(screen.queryByLabelText('숙박 체크인')).toBeNull()
  })
  it('traps modal focus and dismisses an outside backdrop click', () => {
    render(<Harness />)
    const dialog = openDates()
    const first = within(dialog).getByRole('button', { name: '언제 머무르시나요? 닫기' })
    const last = within(dialog).getByRole('button', { name: '날짜 선택 취소' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.click(dialog, { clientX: -1, clientY: -1 })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })
})
