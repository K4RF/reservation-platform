import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../app/routes'
import { AuthProvider } from '../state/AuthProvider'
import { clearAccessToken, setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'
import { reservationDetail } from '../test/reservation'
import { accommodation } from '../test/accommodation'
import { room } from '../test/room'

function signIn() {
  setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
}
function NextReservation() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/reservations/43')}>다른 예약 조회</button>
}
function renderDetail() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/reservations/42']}>
        <AppRoutes />
        <NextReservation />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function respond(url: string, detail = reservationDetail) {
  if (/\/reservations\/\d+$/.test(url)) return Response.json(detail)
  return url.endsWith('/rooms/3')
    ? Response.json({ ...room, nightlyPrice: 9999 })
    : Response.json(accommodation)
}

describe('reservation detail snapshots through router/auth/API client', () => {
  it('shows current catalogue names separately from saved guest, mixed prices and cancellation policy', async () => {
    signIn()
    const mock = vi.fn().mockImplementation((url: string) => respond(url))
    vi.stubGlobal('fetch', mock)
    renderDetail()
    expect(screen.getByText('예약을 불러오고 있습니다.')).toBeTruthy()
    await screen.findByText('guest@example.com')
    expect(screen.getByRole('heading', { name: accommodation.name })).toBeTruthy()
    expect(screen.getByText(`객실: ${room.name}`)).toBeTruthy()
    expect(screen.getByText('예약 확정')).toBeTruthy()
    expect(screen.getByText('홍길동')).toBeTruthy()
    expect(screen.getByText('010-1234-5678')).toBeTruthy()
    expect(screen.getByText('350.25')).toBeTruthy()
    expect(screen.getByText('첫 숙박일 요금 Snapshot: 100.10')).toBeTruthy()
    const table = screen.getByRole('table', { name: '숙박일별 확정 요금 Snapshot' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('100.10')).toBeTruthy()
    expect(within(table).getByText('250.15')).toBeTruthy()
    expect(within(table).queryByText('2030-01-03')).toBeNull()
    expect(screen.getByText('체크인 7일 전 이상: 무료 취소')).toBeTruthy()
    expect(screen.getByText('체크인 3–6일 전: 예약 총액의 30% 수수료')).toBeTruthy()
    expect(screen.getByText('체크인 1–2일 전: 예약 총액의 50% 수수료')).toBeTruthy()
    expect(screen.getByRole('button', { name: '예약 일정 변경 (준비 중)' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: '예약 취소 (준비 중)' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.queryByRole('heading', { name: '저장된 취소 결과' })).toBeNull()
    expect(screen.getByText(/숙소·객실 이름은 현재 정보/)).toBeTruthy()
    expect(
      mock.mock.calls.every(
        ([url, init]) =>
          init.method === 'GET' && !url.includes('/prices/') && !url.includes('/policies'),
      ),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '예약 취소 (준비 중)' }))
    expect(mock).toHaveBeenCalledTimes(3)
  })
  it('shows stored cancellation results in UTC, not payment completion or recalculated estimates', async () => {
    signIn()
    const cancelled = {
      ...reservationDetail,
      status: 'CANCELLED' as const,
      cancelledAt: '2029-12-29T22:15:00Z',
      cancellationFeeAmount: 105.08,
      refundAmount: 245.17,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => respond(url, cancelled)),
    )
    renderDetail()
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    expect(screen.getByText('예약 취소')).toBeTruthy()
    expect(screen.getByText(cancelled.cancelledAt)).toHaveProperty(
      'dateTime',
      cancelled.cancelledAt,
    )
    expect(screen.getByText('105.08')).toBeTruthy()
    expect(screen.getByText('245.17')).toBeTruthy()
    expect(screen.getByText(/결제 취소·환불 완료를 의미하지/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /예약 일정 변경/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /예약 취소/ })).toBeNull()
  })
  it('retains legacy null fields and empty nights without fabricated history even if catalogue fails', async () => {
    signIn()
    const legacy = {
      ...reservationDetail,
      status: 'CANCELLED' as const,
      reservationNumber: null,
      representativeGuest: null,
      nights: [],
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          url.endsWith('/reservations/42')
            ? Response.json(legacy)
            : Promise.reject(new TypeError('offline')),
        ),
    )
    renderDetail()
    await screen.findByText('대표 투숙객 정보가 저장되지 않은 과거 예약입니다.')
    expect(screen.getByText(/숙박일별 요금이 저장되지 않은 과거 예약/)).toBeTruthy()
    expect(screen.getAllByText('저장된 정보 없음')).toHaveLength(3)
    expect(screen.getByText('예약 번호: 미등록 (과거 예약)')).toBeTruthy()
    expect(screen.getByText('객실: 객실 ID: 3')).toBeTruthy()
    expect(screen.getByText('350.25')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })
  it.each([400, 403, 404, 409, 500])(
    'shows HTTP %i failure without exposing a reservation and recovers with GET',
    async (status) => {
      signIn()
      let failed = true
      const mock = vi
        .fn()
        .mockImplementation((url: string) =>
          failed
            ? Response.json({ status, code: 'TEST', message: 'failed' }, { status })
            : respond(url),
        )
      vi.stubGlobal('fetch', mock)
      renderDetail()
      await screen.findByRole('alert')
      expect(screen.queryByText('guest@example.com')).toBeNull()
      expect(screen.queryByRole('button', { name: /예약 취소/ })).toBeNull()
      failed = false
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
      await screen.findByText('guest@example.com')
      expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    },
  )
  it('shows a network error without claiming cancellation or exposing snapshots', async () => {
    signIn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    renderDetail()
    await screen.findByRole('alert')
    expect(screen.getByText(/연결 상태를 확인/)).toBeTruthy()
    expect(screen.queryByText('guest@example.com')).toBeNull()
  })
  it('rejects incomplete detail history instead of rendering a completion projection as full detail', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...reservationDetail, nights: undefined })),
    )
    renderDetail()
    await screen.findByRole('alert')
    expect(screen.getByText('예약 응답 형식을 확인할 수 없습니다.')).toBeTruthy()
    expect(screen.queryByText('guest@example.com')).toBeNull()
  })
  it('ends the session after failed 401 recovery and redirects to login', async () => {
    signIn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 401 })))
    renderDetail()
    await screen.findByRole('heading', { name: '로그인' })
    expect(screen.queryByText('guest@example.com')).toBeNull()
  })
  it('ignores an old detail response after navigating to another reservation', async () => {
    signIn()
    let finish!: (response: Response) => void
    const mock = vi.fn().mockImplementation((url: string) =>
      url.endsWith('/reservations/42')
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : respond(url, {
            ...reservationDetail,
            reservationId: 43,
            representativeGuest: {
              name: '다른 투숙객',
              email: 'other@example.com',
              phone: '010-0000-0000',
            },
          }),
    )
    vi.stubGlobal('fetch', mock)
    renderDetail()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    fireEvent.click(screen.getByRole('button', { name: '다른 예약 조회' }))
    await screen.findByText('other@example.com')
    await act(async () => finish(Response.json(reservationDetail)))
    expect(screen.queryByText('guest@example.com')).toBeNull()
    expect(screen.getByText('other@example.com')).toBeTruthy()
  })
  it('discards personal snapshots on logout', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => respond(url)),
    )
    renderDetail()
    await screen.findByText('guest@example.com')
    act(() => clearAccessToken())
    expect(screen.queryByText('guest@example.com')).toBeNull()
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
  })
  it('remounts and reloads private detail after a new authenticated session', async () => {
    signIn()
    let detail = reservationDetail
    const mock = vi.fn().mockImplementation((url: string) => respond(url, detail))
    vi.stubGlobal('fetch', mock)
    renderDetail()
    await screen.findByText('guest@example.com')
    detail = {
      ...reservationDetail,
      representativeGuest: { name: '새 투숙객', email: 'new@example.com', phone: '010-0000-0000' },
    }
    act(() => signIn())
    expect(screen.queryByText('guest@example.com')).toBeNull()
    await screen.findByText('new@example.com')
    expect(mock.mock.calls.filter(([url]) => url.endsWith('/reservations/42'))).toHaveLength(2)
  })
})
