import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingFlow } from './BookingFlow'
import { room } from '../../test/room'
import type { BookingSelection } from './bookingState'

const selection: BookingSelection = {
  accommodation: { accommodationId: 7, name: '서울 호텔' },
  room,
  stay: { checkInDate: '2030-01-01', checkOutDate: '2030-01-03', guestCount: 2 },
}
function mockPrices() {
  const mock = vi.fn((url: string) =>
    Promise.resolve(
      Response.json({
        roomDailyPriceId: null,
        roomId: Number(url.match(/rooms\/(\d+)/)?.[1]),
        stayDate: url.slice(-10),
        nightlyPrice: 100,
        source: 'DEFAULT',
      }),
    ),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}
function fill() {
  for (const [label, value] of [
    ['대표 투숙객 이름', '홍길동'],
    ['대표 투숙객 이메일', 'guest@example.com'],
    ['대표 투숙객 연락처', '010-1234-5678'],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
const review = () => fireEvent.submit(screen.getByRole('form', { name: '대표 투숙객 정보' }))
describe('BookingFlow', () => {
  it('validates fields, preserves edits, and reviews real selection and guest info without creating a reservation', async () => {
    const mock = mockPrices()
    render(<BookingFlow selection={selection} />)
    expect((screen.getByLabelText('대표 투숙객 이메일') as HTMLInputElement).value).toBe('')
    review()
    expect(screen.getAllByRole('alert')).toHaveLength(3)
    fill()
    review()
    await screen.findByText('총 예상 금액: 200.00')
    expect(screen.getByText('숙소: 서울 호텔')).toBeTruthy()
    expect(screen.getByText('대표 투숙객: 홍길동')).toBeTruthy()
    expect(screen.getByText('안내 이메일: guest@example.com')).toBeTruthy()
    expect(screen.getByText(/요청 2명/)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: '예약 생성 (후속 작업)' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '투숙객 정보 수정' }))
    expect((screen.getByLabelText('대표 투숙객 이름') as HTMLInputElement).value).toBe('홍길동')
    fireEvent.change(screen.getByLabelText('대표 투숙객 이름'), { target: { value: '김민수' } })
    review()
    expect(screen.getByText('대표 투숙객: 김민수')).toBeTruthy()
    expect(mock.mock.calls.every(([url]) => url.includes('/prices/'))).toBe(true)
  })
  it.each([
    null,
    { ...selection, stay: { ...selection.stay, checkInDate: '' } },
    { ...selection, stay: { ...selection.stay, guestCount: 3 } },
  ])('blocks invalid state before any request %j', (value) => {
    const mock = mockPrices()
    render(<BookingFlow selection={value} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('form')).toBeNull()
    expect(mock).not.toHaveBeenCalled()
  })
  it.each([
    { ...selection, room: { ...room, roomId: 4 } },
    { ...selection, stay: { ...selection.stay, checkOutDate: '2030-01-04' } },
    { ...selection, stay: { ...selection.stay, guestCount: 1 } },
    { ...selection, accommodation: { accommodationId: 8 }, room: { ...room, accommodationId: 8 } },
  ])('resets guest and review state on selection changes %j', (next) => {
    mockPrices()
    const view = render(<BookingFlow selection={selection} />)
    fill()
    review()
    view.rerender(<BookingFlow selection={next} />)
    expect(screen.queryByText('제출 전 최종 확인')).toBeNull()
    expect((screen.getByLabelText('대표 투숙객 이름') as HTMLInputElement).value).toBe('')
  })
  it('discards guest state on unmount/remount (refresh or page exit policy)', () => {
    mockPrices()
    const view = render(<BookingFlow selection={selection} />)
    fill()
    view.unmount()
    render(<BookingFlow selection={selection} />)
    expect((screen.getByLabelText('대표 투숙객 이메일') as HTMLInputElement).value).toBe('')
  })
  it('keeps price failure explicit while allowing guest review without pretending a final price', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    render(<BookingFlow selection={selection} />)
    fill()
    review()
    await screen.findByText('요금을 확인하지 못했습니다. 예상 금액을 제공할 수 없습니다.')
    expect(screen.getByText('제출 전 최종 확인')).toBeTruthy()
    expect(screen.queryByText(/총 예상 금액:/)).toBeNull()
  })
})
