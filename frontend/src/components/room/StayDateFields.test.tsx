import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StayDateFields } from './StayDateFields'
import type { StayDates } from './stayDateRange'

const initial = { checkInDate: '2030-01-01', checkOutDate: '2030-01-03' }
function open() {
  fireEvent.click(screen.getByRole('button', { name: '날짜 달력 열기' }))
}
const panel = () => screen.getByRole('region', { name: '숙박 날짜 달력' })
const date = (value: string) =>
  within(panel()).getByRole('button', { name: new RegExp(`^${value}( |$)`) })
function Harness({
  start = initial,
  onChange = vi.fn(),
  onSubmit = vi.fn(),
}: {
  start?: StayDates
  onChange?: (field: string, value: string) => void
  onSubmit?: () => void
}) {
  const [draft, setDraft] = useState(start)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <StayDateFields
        prefix="test"
        draft={draft}
        onChange={(field, value) => {
          onChange(field, value)
          setDraft((current) => ({ ...current, [field]: value }))
        }}
      />
    </form>
  )
}

describe('shared stay range editing and inline keyboard calendar', () => {
  it('keeps preview separate; cancel/Escape discard changes and restore the trigger without parent calls', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    open()
    expect(document.activeElement).toBe(date('2030-01-01'))
    fireEvent.click(date('2030-01-10'))
    expect(screen.getByLabelText('숙박 체크인')).toHaveProperty('value', '2030-01-01')
    expect(within(panel()).getByRole('status').textContent).toContain('최소 1박')
    fireEvent.click(screen.getByRole('button', { name: '날짜 선택 취소' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '날짜 달력 열기' }))
    open()
    fireEvent.click(date('2030-01-20'))
    fireEvent.keyDown(date('2030-01-20'), { key: 'Escape' })
    expect(screen.queryByRole('region', { name: '숙박 날짜 달력' })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '날짜 달력 열기' }))
  })
  it('applies the full staged range only explicitly and never submits the surrounding form', () => {
    const onChange = vi.fn(),
      onSubmit = vi.fn()
    render(<Harness onChange={onChange} onSubmit={onSubmit} />)
    open()
    fireEvent.click(date('2030-01-10'))
    fireEvent.click(date('2030-01-12'))
    expect(onChange).not.toHaveBeenCalled()
    expect(within(panel()).getByText(/선택 중:.*2박/)).toBeTruthy()
    expect(date('2030-01-11').closest('td')?.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
    expect(onChange.mock.calls).toEqual([
      ['checkInDate', '2030-01-10'],
      ['checkOutDate', '2030-01-12'],
    ])
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2030-01-12')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '날짜 달력 열기' }))
  })
  it('retains later checkout on check-in selection and rejects same/earlier checkout without reversing roles', () => {
    render(<Harness />)
    open()
    fireEvent.click(date('2030-01-02'))
    fireEvent.click(date('2030-01-02'))
    expect(within(panel()).getByRole('status').textContent).toContain('체크인보다 늦어야')
    fireEvent.click(date('2030-01-01'))
    expect(
      within(panel()).getByText(/선택 중: 체크인 2030-01-02 ~ 체크아웃 2030-01-03 · 1박/),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2030-01-03')
  })
  it('preserves direct input, normalizes check-in only, leaves invalid checkout to validation, and names fields for FormData', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('숙박 체크인'), { target: { value: '2028-02-29' } })
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2030-01-03')
    fireEvent.change(screen.getByLabelText('숙박 체크인'), { target: { value: '2030-12-31' } })
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2031-01-01')
    expect(screen.getByRole('status').textContent).toContain('보정')
    fireEvent.change(screen.getByLabelText('숙박 체크아웃'), { target: { value: '2030-12-31' } })
    expect(screen.getByLabelText('숙박 체크아웃')).toHaveProperty('value', '2030-12-31')
    expect(
      new FormData(screen.getByLabelText('숙박 체크인').closest('form')!).get('checkInDate'),
    ).toBe('2030-12-31')
  })
  it('supports roving arrows, week/month keys, leap days, explicit role switch, and one tab stop in the grid', () => {
    render(<Harness start={{ checkInDate: '2028-02-28', checkOutDate: '2028-03-02' }} />)
    open()
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
        .filter((button) => button.tabIndex === 0),
    ).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '체크아웃 선택' }))
    expect(screen.getByRole('button', { name: '체크아웃 선택' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })
  it('handles manual month jumps, year limits and invalid apply without inventing past-date restrictions', () => {
    render(<Harness start={{ checkInDate: '', checkOutDate: '' }} />)
    open()
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
  it('does not invalidate a valid parent query when applying an unchanged range', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    open()
    fireEvent.click(screen.getByRole('button', { name: '날짜 적용' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not implicitly submit from calendar month input or bypass an enclosing disabled fieldset', () => {
    const onSubmit = vi.fn()
    const view = render(<Harness onSubmit={onSubmit} />)
    open()
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
    expect(
      screen.getByRole('button', { name: '날짜 달력 열기' }).closest('fieldset'),
    ).toHaveProperty('disabled', true)
    expect(screen.getByLabelText('숙박 체크인').closest('fieldset')).toHaveProperty(
      'disabled',
      true,
    )
  })
})
