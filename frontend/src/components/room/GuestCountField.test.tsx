import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuestCountField } from './GuestCountField'

function Harness({ initial = '1', required = true } = {}) {
  const [value, setValue] = useState(initial)
  return <GuestCountField id="guests" value={value} onChange={setValue} required={required} />
}
const input = () => screen.getByRole('spinbutton', { name: '숙박 인원' })
const less = () => screen.getByRole('button', { name: '숙박 인원 1명 줄이기' })
const more = () => screen.getByRole('button', { name: '숙박 인원 1명 늘리기' })

describe('total guest count input and stepper', () => {
  it('steps by one, disables decrement at one, and announces the total without adult/child inputs', () => {
    render(<Harness />)
    expect(less()).toHaveProperty('disabled', true)
    fireEvent.click(more())
    expect(input()).toHaveProperty('value', '2')
    expect(less()).toHaveProperty('disabled', false)
    const summary = screen.getByText('전체 2명')
    expect(summary.getAttribute('aria-live')).toBe('polite')
    expect(summary.getAttribute('aria-atomic')).toBe('true')
    expect(input().getAttribute('aria-describedby')).toContain(summary.id)
    expect(screen.getByText(/성인·아동을 합한 전체 인원/)).toBeTruthy()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
    fireEvent.click(less())
    expect(document.activeElement).toBe(input())
    fireEvent.click(less())
    expect(input()).toHaveProperty('value', '1')
  })

  it('supports large direct values and the actual API upper boundary without an arbitrary capacity cap', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: '2147483646' } })
    fireEvent.click(more())
    expect(input()).toHaveProperty('value', '2147483647')
    expect(document.activeElement).toBe(input())
    expect(more()).toHaveProperty('disabled', true)
    fireEvent.click(more())
    expect(input()).toHaveProperty('value', '2147483647')
    fireEvent.click(less())
    expect(input()).toHaveProperty('value', '2147483646')
    expect(more()).toHaveProperty('disabled', false)
    expect(input().getAttribute('min')).toBe('1')
    expect(input().getAttribute('max')).toBe('2147483647')
    expect(input().getAttribute('step')).toBe('1')
    expect(input().getAttribute('inputmode')).toBe('numeric')
  })

  it.each(['0', '-1', '1.5', '2147483648', '999999999999999999999'])(
    'retains invalid direct value %s without rounding, clamping or step repair',
    (value) => {
      render(<Harness />)
      fireEvent.change(input(), { target: { value } })
      expect(input()).toHaveProperty('value', value)
      expect(input().getAttribute('aria-invalid')).toBe('true')
      expect(less()).toHaveProperty('disabled', true)
      expect(more()).toHaveProperty('disabled', true)
      expect(screen.getByText('1~2,147,483,647 사이의 정수를 입력하세요.')).toBeTruthy()
      fireEvent.change(input(), { target: { value: '12' } })
      expect(input().getAttribute('aria-invalid')).toBe('false')
      expect(screen.getByText('전체 12명')).toBeTruthy()
    },
  )

  it.each([true, false])(
    'keeps empty input editable with required=%s, and + explicitly chooses one',
    (required) => {
      render(<Harness initial="2" required={required} />)
      fireEvent.change(input(), { target: { value: '' } })
      expect(input()).toHaveProperty('value', '')
      expect(input()).toHaveProperty('required', required)
      expect(input().getAttribute('aria-invalid')).toBe(String(required))
      expect(less()).toHaveProperty('disabled', true)
      expect(more()).toHaveProperty('disabled', false)
      if (!required) expect(screen.getByText('인원 조건 없음 · + 또는 직접 입력')).toBeTruthy()
      fireEvent.click(more())
      expect(input()).toHaveProperty('value', '1')
    },
  )

  it('uses native buttons and a named numeric input, changing only once without submitting its form', () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn((event) => event.preventDefault())
    render(
      <form aria-label="test" onSubmit={onSubmit}>
        <GuestCountField id="guests" value="2" onChange={onChange} />
      </form>,
    )
    fireEvent.click(more())
    expect(onChange).toHaveBeenCalledExactlyOnceWith('3')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(more().getAttribute('type')).toBe('button')
    expect(less().getAttribute('type')).toBe('button')
    expect(more().getAttribute('aria-controls')).toBe(input().id)
    const data = new FormData(screen.getByRole('form', { name: 'test' }) as HTMLFormElement)
    expect(data.getAll('guestCount')).toEqual(['2'])
  })
})
