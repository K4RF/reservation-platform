import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ReservationList } from './ReservationList'
import { toReservationCard } from './reservationView'
import { reservationResult } from '../../test/reservation'

describe('ReservationList and card mapping', () => {
  it('shows confirmed/cancelled rows using server IDs, real snapshots, and current catalog names', () => {
    const catalog = {
      roomName: '현재 객실 이름',
      accommodationName: '현재 숙소 이름',
      accommodationId: 7,
    }
    render(
      <MemoryRouter>
        <ReservationList
          reservations={[
            toReservationCard(reservationResult, catalog),
            toReservationCard({ ...reservationResult, reservationId: 43, status: 'CANCELLED' }),
          ]}
        />
      </MemoryRouter>,
    )
    const card = within(screen.getByRole('article', { name: '예약 42' }))
    expect(
      screen
        .getByRole('article', { name: '예약 42' })
        .classList.contains('reservation-summary-confirmed'),
    ).toBe(true)
    expect(
      screen
        .getByRole('article', { name: '예약 43' })
        .classList.contains('reservation-summary-cancelled'),
    ).toBe(true)
    expect(card.getByRole('heading', { name: '현재 숙소 이름' })).toBeTruthy()
    expect(card.getByText('객실: 현재 객실 이름')).toBeTruthy()
    expect(card.getByText('예약 ID: 42 · 현재 카탈로그 이름')).toBeTruthy()
    expect(
      within(screen.getByRole('article', { name: '예약 43' })).getByText(
        '예약 ID: 43 · 현재 카탈로그 일부 미조회',
      ),
    ).toBeTruthy()
    expect(card.getByText(`예약 번호: ${reservationResult.reservationNumber}`)).toBeTruthy()
    expect(card.getByText('2030-01-01')).toBeTruthy()
    expect(card.getByText('2030-01-03')).toBeTruthy()
    expect(card.getByText('2030-01-01').getAttribute('datetime')).toBe('2030-01-01')
    expect(card.getByText('2030-01-03').getAttribute('datetime')).toBe('2030-01-03')
    expect(card.getByText('2박 · 2명')).toBeTruthy()
    expect(card.getByText('350.25')).toBeTruthy()
    expect(card.getByText('예약 확정')).toBeTruthy()
    expect(card.getByRole('link', { name: '예약 42 상세 보기' }).getAttribute('href')).toBe(
      '/reservations/42',
    )
    expect(screen.getByText('예약 취소')).toBeTruthy()
    expect(screen.getByText('객실: 객실 ID: 3')).toBeTruthy()
    expect(screen.queryByText(/guest@example.com/)).toBeNull()
    expect(screen.queryByText(/생성 일시/)).toBeNull()
  })
  it('shows a legacy number fallback without inventing historical data', () => {
    render(
      <MemoryRouter>
        <ReservationList
          reservations={[toReservationCard({ ...reservationResult, reservationNumber: null })]}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('예약 번호: 미등록 (과거 예약)')).toBeTruthy()
  })
  it('offers public exploration when there are no reservations', () => {
    render(
      <MemoryRouter>
        <ReservationList reservations={[]} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status').textContent).toBe('표시할 예약이 없습니다.')
    expect(screen.getByRole('link', { name: '숙소 둘러보기' }).getAttribute('href')).toBe(
      '/accommodations',
    )
    expect(screen.queryByRole('list')).toBeNull()
  })
})
