import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccommodationDetailPage } from './AccommodationDetailPage'
import { accommodation } from '../test/accommodation'
import { roomPage } from '../test/room'
import { AuthProvider } from '../state/AuthProvider'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

function Navigation() {
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => navigate('/other')}>화면 이탈</button>
      <button onClick={() => navigate(-1)}>뒤로가기</button>
      <button onClick={() => navigate(1)}>앞으로가기</button>
    </>
  )
}
describe('booking flow page lifecycle', () => {
  it('connects real detail/availability/guest/review and resets booking state after history return', async () => {
    const mock = vi.fn((url: string) =>
      Promise.resolve(
        Response.json(
          url.includes('/prices/')
            ? {
                roomDailyPriceId: null,
                roomId: 3,
                stayDate: url.slice(-10),
                nightlyPrice: 100,
                source: 'DEFAULT',
              }
            : url.includes('/rooms')
              ? roomPage()
              : accommodation,
        ),
      ),
    )
    vi.stubGlobal('fetch', mock)
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/accommodations/7']}>
          <Navigation />
          <Routes>
            <Route path="/accommodations/:accommodationId" element={<AccommodationDetailPage />} />
            <Route path="/other" element={<p>다른 화면</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    await screen.findByLabelText('숙박 체크인')
    fireEvent.change(screen.getByLabelText('숙박 체크인'), { target: { value: '2030-01-01' } })
    fireEvent.change(screen.getByLabelText('숙박 체크아웃'), { target: { value: '2030-01-03' } })
    fireEvent.submit(screen.getByRole('form', { name: '객실 가용성 조건' }))
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    for (const [label, value] of [
      ['대표 투숙객 이름', '홍길동'],
      ['대표 투숙객 이메일', 'guest@example.com'],
      ['대표 투숙객 연락처', '010-1234-5678'],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.submit(screen.getByRole('form', { name: '대표 투숙객 정보' }))
    await screen.findByText('총 예상 금액: 200.00')
    expect(screen.getByText('숙소: 서울 호텔')).toBeTruthy()
    expect(screen.getByText('대표 투숙객: 홍길동')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '화면 이탈' }))
    expect(screen.queryByText('제출 전 최종 확인')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    await screen.findByLabelText('숙박 체크인')
    expect((screen.getByLabelText('숙박 체크인') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '앞으로가기' }))
    expect(screen.getByText('다른 화면')).toBeTruthy()
    expect(mock.mock.calls.every(([url]) => !url.includes('/reservations'))).toBe(true)
  })
})
