import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { BookingCompletePage } from './BookingCompletePage'
import { reservationResult } from '../test/reservation'
import { room } from '../test/room'
import { accommodation } from '../test/accommodation'
import { media } from '../test/media'

function mockResult() {
  const photo = media()
  const mock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>((url) =>
    Promise.resolve(
      Response.json(
        url.endsWith('/reservations/42')
          ? reservationResult
          : url.endsWith('/rooms/3')
            ? { ...room, representativeImage: photo, images: [photo] }
            : accommodation,
      ),
    ),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

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
    const mock = mockResult()
    renderAt()
    await screen.findByText('예약이 확정되었습니다.')
    expect(screen.getByText(`예약 번호: ${reservationResult.reservationNumber}`)).toBeTruthy()
    expect(screen.getByText('예약 금액: 350.25')).toBeTruthy()
    const saved = within(screen.getByRole('region', { name: '예약 금액' }))
    expect(saved.getByText('예약 금액: 350.25')).toBeTruthy()
    expect(screen.getByRole('region', { name: '저장된 예약 정보' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '저장된 대표 투숙객' })).toBeTruthy()
    expect(screen.queryByText(/총 예상 금액:/)).toBeNull()
    const actions = within(screen.getByRole('navigation', { name: '예약 결과 다음 단계' }))
    expect(actions.getAllByRole('link')).toHaveLength(3)
    expect(actions.getByRole('link', { name: '예약 상세 보기' }).getAttribute('href')).toBe(
      '/reservations/42',
    )
    expect(actions.getByRole('link', { name: '숙소 검색으로 돌아가기' }).getAttribute('href')).toBe(
      '/accommodations',
    )
    expect(actions.getByRole('link', { name: '내 예약 목록 확인' }).getAttribute('href')).toBe(
      '/reservations',
    )
    expect(screen.getByText(/결제 완료를 의미하지 않습니다/)).toBeTruthy()
    expect(mock.mock.calls[0][1].method).toBe('GET')
    await screen.findByRole('heading', { name: accommodation.name })
    expect(mock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/reservations/42',
      '/api/v1/rooms/3',
      '/api/v1/accommodations/7',
    ])
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('예약 금액: 350.25')).toBeTruthy()
    expect(screen.getByText(/예약 당시 기록이 아닙니다/)).toBeTruthy()
    expect(mock).toHaveBeenCalledTimes(3)
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
    expect(
      screen
        .getByRole('heading', { name: '취소된 예약입니다.' })
        .classList.contains('booking-result-cancelled'),
    ).toBe(true)
    expect(screen.queryByText('예약이 확정되었습니다.')).toBeNull()
  })
  it('keeps unknown legacy guest and number explicit without inventing saved values', async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...reservationResult, reservationNumber: null, representativeGuest: null }),
      )
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByText('예약 번호: 미등록')
    expect(screen.getByText('과거 예약의 대표 투숙객 정보가 없습니다.')).toBeTruthy()
    expect(screen.queryByText(/안내 이메일:/)).toBeNull()
    expect(mock.mock.calls.filter(([url]) => url.endsWith('/reservations/42'))).toHaveLength(1)
  })
  it('keeps saved status and money when optional current catalog fails and retries only that GET', async () => {
    const mock = mockResult()
    mock.mockImplementation((url: string) =>
      url.endsWith('/reservations/42')
        ? Promise.resolve(Response.json(reservationResult))
        : Promise.reject(new TypeError('offline')),
    )
    renderAt()
    await screen.findByText(/현재 이름과 사진을 불러오지 못했습니다/)
    expect(screen.getByText('예약이 확정되었습니다.')).toBeTruthy()
    expect(screen.getByText('예약 금액: 350.25')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '객실 정보 다시 보기' }))
    await screen.findByRole('button', { name: '객실 정보 다시 보기' })
    expect(mock.mock.calls.filter(([url]) => url.endsWith('/reservations/42'))).toHaveLength(1)
    expect(mock.mock.calls.filter(([url]) => url.endsWith('/rooms/3'))).toHaveLength(2)
  })
})
