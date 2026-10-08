import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { BookingCompletePage } from './BookingCompletePage'
import { reservationResult } from '../test/reservation'

function renderAt(path = '/reservations/42/complete') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reservations/:reservationId/complete" element={<BookingCompletePage />} />
      </Routes>
    </MemoryRouter>,
  )
}
describe('completion owner lookup', () => {
  it('loads server result without navigation state and shows authoritative amount/number', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(reservationResult))
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByText('예약이 확정되었습니다.')
    expect(screen.getByText(`예약 번호: ${reservationResult.reservationNumber}`)).toBeTruthy()
    expect(screen.getByText('예약 금액 Snapshot: 350.25')).toBeTruthy()
    expect(screen.getByText(/결제 완료를 의미하지 않습니다/)).toBeTruthy()
    expect(mock.mock.calls[0][1].method).toBe('GET')
  })
  it.each(['abc', '0', '9007199254740992'])('blocks invalid %s without fetch', (id) => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    renderAt(`/reservations/${id}/complete`)
    expect(screen.getByRole('alert').textContent).toContain('올바르지 않은 예약 ID')
    expect(mock).not.toHaveBeenCalled()
  })
  it.each([403, 404])(
    'never claims completion after HTTP %i and retries only GET',
    async (status) => {
      const mock = vi
        .fn()
        .mockResolvedValueOnce(Response.json({}, { status }))
        .mockResolvedValue(Response.json(reservationResult))
      vi.stubGlobal('fetch', mock)
      renderAt()
      await screen.findByRole('alert')
      expect(screen.queryByText('예약이 확정되었습니다.')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      await screen.findByText('예약이 확정되었습니다.')
      expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    },
  )
  it('shows current cancellation instead of fake success when revisiting a completed URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...reservationResult, status: 'CANCELLED' })),
    )
    renderAt()
    await screen.findByText('취소된 예약입니다.')
    expect(screen.queryByText('예약이 확정되었습니다.')).toBeNull()
  })
})
