import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../app/routes'
import { AuthProvider } from '../state/AuthProvider'
import { clearAccessToken, setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'
import {
  reservationDetail,
  changedReservationDetail,
  cancellationResponse,
  cancelledReservationDetail,
  reservationPage,
} from '../test/reservation'
import { accommodation } from '../test/accommodation'
import { room, roomPage } from '../test/room'

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

async function confirmChange() {
  fireEvent.click(await screen.findByRole('button', { name: '예약 일정 변경 준비' }))
  fireEvent.change(screen.getByLabelText('새 체크인'), { target: { value: '2030-01-02' } })
  fireEvent.change(screen.getByLabelText('새 체크아웃'), { target: { value: '2030-01-04' } })
  fireEvent.submit(screen.getByRole('form', { name: '예약 변경 날짜 조건' }))
  await screen.findByText('현재 객실이 일반 신규 예약 가능 목록에 없습니다.')
  fireEvent.click(screen.getByRole('button', { name: '일정 변경 내용 확인' }))
  await screen.findByText('새 일정 참고 예상 총액: 200.20')
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '예약 일정 변경 확정' }))
}

function changeFlowResponse(url: string, detail = reservationDetail) {
  if (url.includes('/rooms/available?'))
    return Response.json(roomPage({ content: [], totalElements: 0, totalPages: 0 }))
  if (url.includes('/prices/'))
    return Response.json({
      roomId: 3,
      stayDate: url.slice(-10),
      nightlyPrice: 100.1,
      source: 'DEFAULT',
      roomDailyPriceId: null,
    })
  return respond(url, detail)
}

async function confirmCancellation() {
  fireEvent.click(await screen.findByRole('button', { name: '취소 정책 및 수수료 확인' }))
  await screen.findByText('취소 전 예상 수수료 금액: 제공되지 않음')
  const panel = screen.getByRole('region', { name: '취소 전 확인' })
  fireEvent.click(within(panel).getByRole('checkbox'))
  fireEvent.click(within(panel).getByRole('button', { name: '예약 취소 확정' }))
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
    const priceScroll = screen.getByRole('region', { name: '저장된 숙박 요금 표' })
    expect(priceScroll.tabIndex).toBe(0)
    expect(priceScroll.getAttribute('aria-describedby')).toBe('saved-price-scroll-hint')
    expect(within(priceScroll).getByRole('table')).toBe(table)
    expect(screen.getByRole('group', { name: '일정 변경' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('group', { name: '예약 취소' })).toHaveProperty('disabled', false)
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(within(table).getByText('100.10')).toBeTruthy()
    expect(within(table).getByText('250.15')).toBeTruthy()
    expect(within(table).queryByText('2030-01-03')).toBeNull()
    expect(screen.getByText('체크인 7일 전 이상: 무료 취소')).toBeTruthy()
    expect(screen.getByText('체크인 3–6일 전: 예약 총액의 30% 수수료')).toBeTruthy()
    expect(screen.getByText('체크인 1–2일 전: 예약 총액의 50% 수수료')).toBeTruthy()
    expect(screen.getByRole('button', { name: '예약 일정 변경 준비' })).toHaveProperty(
      'disabled',
      false,
    )
    expect(screen.getByRole('button', { name: '취소 정책 및 수수료 확인' })).toHaveProperty(
      'disabled',
      false,
    )
    expect(screen.queryByRole('heading', { name: '저장된 취소 결과' })).toBeNull()
    expect(screen.getByText(/숙소·객실 이름은 현재 정보/)).toBeTruthy()
    expect(
      mock.mock.calls.every(
        ([url, init]) =>
          init.method === 'GET' && !url.includes('/prices/') && !url.includes('/policies'),
      ),
    ).toBe(true)
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
  it('opens date preparation from owner detail and keeps snapshots after advisory unavailability', async () => {
    signIn()
    const mock = vi
      .fn()
      .mockImplementation((url: string) =>
        url.includes('/rooms/available?')
          ? Response.json(roomPage({ content: [], totalElements: 0, totalPages: 0 }))
          : respond(url),
      )
    vi.stubGlobal('fetch', mock)
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: '예약 일정 변경 준비' }))
    fireEvent.change(screen.getByLabelText('새 체크인'), { target: { value: '2030-01-02' } })
    fireEvent.change(screen.getByLabelText('새 체크아웃'), { target: { value: '2030-01-04' } })
    fireEvent.submit(screen.getByRole('form', { name: '예약 변경 날짜 조건' }))
    await screen.findByText('현재 객실이 일반 신규 예약 가능 목록에 없습니다.')
    expect(screen.getByText('guest@example.com')).toBeTruthy()
    expect(screen.getByText('350.25')).toBeTruthy()
    expect(screen.getByText('현재 예약 일정: 2030-01-01 ~ 2030-01-03')).toBeTruthy()
    expect(screen.getByText(/이 결과만으로 변경을 차단하지/)).toBeTruthy()
    const ownerGet = mock.mock.calls.find(([url]) => url.endsWith('/reservations/42'))!
    const availabilityGet = mock.mock.calls.find(([url]) => url.includes('/rooms/available?'))!
    expect(new Headers(ownerGet[1].headers).has('Authorization')).toBe(true)
    expect(new Headers(availabilityGet[1].headers).has('Authorization')).toBe(false)
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
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
  it('changes despite advisory absence and reloads all saved detail snapshots from GET', async () => {
    signIn()
    let detail = reservationDetail
    const mock = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        detail = changedReservationDetail
        return Response.json(detail)
      }
      return changeFlowResponse(url, detail)
    })
    vi.stubGlobal('fetch', mock)
    renderDetail()
    await confirmChange()
    await screen.findByText('첫 숙박일 요금 Snapshot: 250.15')
    expect(screen.getByText('550.15')).toBeTruthy()
    expect(screen.getByText(/일정 변경 완료: 2030-01-02 ~ 2030-01-04/)).toBeTruthy()
    expect(screen.queryByText('350.25')).toBeNull()
    expect(screen.queryByText('기존 확정 총액: 350.25')).toBeNull()
    expect(screen.getByText('guest@example.com')).toBeTruthy()
    expect(screen.getByText('체크인 7일 전 이상: 무료 취소')).toBeTruthy()
    const table = screen.getByRole('table', { name: '숙박일별 확정 요금 Snapshot' })
    expect(within(table).getByText('2030-01-03')).toBeTruthy()
    expect(within(table).queryByText('2030-01-01')).toBeNull()
    expect(mock.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
    expect(
      mock.mock.calls.filter(
        ([url, init]) => url.endsWith('/reservations/42') && init.method === 'GET',
      ),
    ).toHaveLength(2)
    for (const [url, init] of mock.mock.calls) {
      expect(new Headers(init.headers).has('Authorization')).toBe(url.includes('/reservations/'))
    }
  })
  it('preserves original detail and date inputs on inventory conflict', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) =>
        init.method === 'PATCH'
          ? Response.json(
              { status: 409, code: 'INVENTORY_011', message: '재고 충돌' },
              { status: 409 },
            )
          : changeFlowResponse(url),
      ),
    )
    renderDetail()
    await confirmChange()
    expect((await screen.findByRole('alert')).textContent).toContain('INVENTORY_011')
    expect(screen.getByText('350.25')).toBeTruthy()
    expect(screen.getByText('첫 숙박일 요금 Snapshot: 100.10')).toBeTruthy()
    expect(screen.getByLabelText('새 체크인')).toHaveProperty('value', '2030-01-02')
    expect(screen.getByRole('button', { name: '변경 날짜 가용성 조회' })).toHaveProperty(
      'disabled',
      false,
    )
  })
  it('locks editing/closing after lost acknowledgement and recovers by detail GET only', async () => {
    signIn()
    let detail = reservationDetail
    const mock = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        detail = changedReservationDetail
        return Promise.reject(new TypeError('lost response'))
      }
      return Promise.resolve(changeFlowResponse(url, detail))
    })
    vi.stubGlobal('fetch', mock)
    renderDetail()
    await confirmChange()
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: '예약 일정 변경 준비' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByLabelText('새 체크인').closest('fieldset')).toHaveProperty('disabled', true)
    expect(screen.getByText('350.25')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    await screen.findByText('첫 숙박일 요금 Snapshot: 250.15')
    expect(screen.getByText('550.15')).toBeTruthy()
    expect(screen.getByText(/변경 요청은 다시 보내지 않습니다/)).toBeTruthy()
    expect(mock.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
  })
  it('returns to login on PATCH 401 without mutation replay or refresh', async () => {
    signIn()
    const mock = vi.fn((url: string, init: RequestInit) =>
      init.method === 'PATCH' ? Response.json({}, { status: 401 }) : changeFlowResponse(url),
    )
    vi.stubGlobal('fetch', mock)
    renderDetail()
    await confirmChange()
    await screen.findByRole('heading', { name: '로그인' })
    expect(screen.queryByText('guest@example.com')).toBeNull()
    expect(mock.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
    expect(mock.mock.calls.some(([url]) => url.includes('/reissue'))).toBe(false)
  })
  it('discards reference prices and acknowledgement when dates change before PATCH', async () => {
    signIn()
    const mock = vi.fn().mockImplementation((url: string) => changeFlowResponse(url))
    vi.stubGlobal('fetch', mock)
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: '예약 일정 변경 준비' }))
    fireEvent.change(screen.getByLabelText('새 체크인'), { target: { value: '2030-01-02' } })
    fireEvent.change(screen.getByLabelText('새 체크아웃'), { target: { value: '2030-01-04' } })
    fireEvent.submit(screen.getByRole('form', { name: '예약 변경 날짜 조건' }))
    fireEvent.click(screen.getByRole('button', { name: '일정 변경 내용 확인' }))
    await screen.findByText('새 일정 참고 예상 총액: 200.20')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('새 체크아웃'), { target: { value: '2030-01-05' } })
    expect(screen.queryByText('새 일정 참고 예상 총액: 200.20')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.submit(screen.getByRole('form', { name: '예약 변경 날짜 조건' }))
    fireEvent.click(screen.getByRole('button', { name: '일정 변경 내용 확인' }))
    await screen.findByText('새 일정 참고 예상 총액: 300.30')
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
    expect(screen.getByRole('button', { name: '예약 일정 변경 확정' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByText('350.25')).toBeTruthy()
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it('retries only detail GET when refresh after acknowledged success fails', async () => {
    signIn()
    let changed = false,
      failRead = true
    const mock = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        changed = true
        return Response.json(changedReservationDetail)
      }
      if (url.endsWith('/reservations/42') && changed && failRead)
        return Response.json({}, { status: 500 })
      return changeFlowResponse(url, changed ? changedReservationDetail : reservationDetail)
    })
    vi.stubGlobal('fetch', mock)
    renderDetail()
    await confirmChange()
    await screen.findByRole('alert')
    expect(screen.getByText(/일정 변경 완료: 2030-01-02 ~ 2030-01-04/)).toBeTruthy()
    failRead = false
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('첫 숙박일 요금 Snapshot: 250.15')
    expect(mock.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
  })
  it('rechecks stored cancellation policy through owner GET and never quotes or cancels', async () => {
    signIn()
    const mock = vi.fn().mockImplementation((url: string) => respond(url))
    vi.stubGlobal('fetch', mock)
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: '취소 정책 및 수수료 확인' }))
    await screen.findByText('취소 전 예상 수수료 금액: 제공되지 않음')
    const panel = screen.getByRole('region', { name: '취소 전 확인' })
    expect(within(panel).getByText('체크인 7일 전 이상: 무료 취소')).toBeTruthy()
    expect(within(panel).getByText('취소 전 예상 환불 금액: 제공되지 않음')).toBeTruthy()
    expect(within(panel).getByRole('button', { name: '예약 취소 확정' })).toHaveProperty(
      'disabled',
      true,
    )
    fireEvent.click(within(panel).getByRole('checkbox'))
    expect(within(panel).getByRole('button', { name: '예약 취소 확정' })).toHaveProperty(
      'disabled',
      false,
    )
    expect(screen.getByText('guest@example.com')).toBeTruthy()
    expect(screen.getByText('350.25')).toBeTruthy()
    const reads = mock.mock.calls.filter(([url]) => url.endsWith('/reservations/42'))
    expect(reads).toHaveLength(2)
    expect(reads.every(([, init]) => new Headers(init.headers).has('Authorization'))).toBe(true)
    expect(
      mock.mock.calls.every(
        ([url, init]) => init.method === 'GET' && !/cancel|preview|quote|polic/.test(url),
      ),
    ).toBe(true)
  })
  it('refreshes full detail if confirmation read discovers a cancellation on the server', async () => {
    signIn()
    let detail = reservationDetail
    const mock = vi.fn().mockImplementation((url: string) => respond(url, detail))
    vi.stubGlobal('fetch', mock)
    renderDetail()
    await screen.findByText('guest@example.com')
    detail = {
      ...reservationDetail,
      status: 'CANCELLED',
      cancelledAt: '2029-12-30T00:00:00Z',
      cancellationFeeAmount: 175.13,
      refundAmount: 175.12,
    }
    fireEvent.click(screen.getByRole('button', { name: '취소 정책 및 수수료 확인' }))
    await screen.findByRole('heading', { name: '이미 취소된 예약의 저장 결과' })
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    expect(screen.queryByRole('button', { name: '취소 정책 및 수수료 확인' })).toBeNull()
    expect(screen.queryByRole('button', { name: '예약 일정 변경 준비' })).toBeNull()
    expect(screen.getByText('175.13')).toBeTruthy()
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it('discards confirmation snapshots and late responses on logout', async () => {
    signIn()
    let reads = 0
    let finish!: (value: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.endsWith('/reservations/42') && ++reads === 2)
          return new Promise<Response>((resolve) => {
            finish = resolve
          })
        return respond(url)
      }),
    )
    renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: '취소 정책 및 수수료 확인' }))
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    act(() => clearAccessToken())
    await act(async () => finish(Response.json(reservationDetail)))
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '취소 전 확인' })).toBeNull()
    expect(screen.queryByText('guest@example.com')).toBeNull()
  })
  it('cancels once, displays every authoritative response field and refreshes detail and list', async () => {
    signIn()
    let detail = reservationDetail
    const fetch = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        detail = cancelledReservationDetail
        return Response.json(cancellationResponse)
      }
      if (url.includes('/reservations?'))
        return Response.json(reservationPage({ content: [detail] }))
      return respond(url, detail)
    })
    vi.stubGlobal('fetch', fetch)
    renderDetail()
    await confirmCancellation()
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    const result = screen.getByRole('region', { name: '예약 취소 완료' })
    for (const text of [
      cancellationResponse.cancelledAt,
      '2029-12-30',
      '2일',
      '350.25',
      '50%',
      '175.13',
      '175.12',
    ]) {
      expect(within(result).getByText(text)).toBeTruthy()
    }
    expect(screen.getByText('예약 취소')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '취소 정책 및 수수료 확인' })).toBeNull()
    expect(screen.queryByRole('button', { name: '예약 일정 변경 준비' })).toBeNull()
    expect(
      fetch.mock.calls.filter(
        ([url, init]) => url.endsWith('/reservations/42') && init.method === 'GET',
      ),
    ).toHaveLength(3)
    fireEvent.click(screen.getByRole('link', { name: '내 예약 목록으로' }))
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    expect(screen.getByText('예약 취소')).toBeTruthy()
    expect(fetch.mock.calls.filter(([url]) => url.includes('/reservations?'))).toHaveLength(1)
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
  })
  it('keeps acknowledged success feedback when detail refresh fails and retries GET only', async () => {
    signIn()
    let done = false,
      fail = true
    const fetch = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        done = true
        return Response.json(cancellationResponse)
      }
      if (done && fail && url.endsWith('/reservations/42'))
        return Response.json({}, { status: 500 })
      return respond(url, done ? cancelledReservationDetail : reservationDetail)
    })
    vi.stubGlobal('fetch', fetch)
    renderDetail()
    await confirmCancellation()
    await screen.findByRole('alert')
    expect(screen.getByRole('heading', { name: '예약 취소 완료' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '예약 취소 확정' })).toBeNull()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
  })
  it('confirms server cancellation after lost response without replay or fabricated success metadata', async () => {
    signIn()
    let detail = reservationDetail
    const fetch = vi.fn((url: string, init: RequestInit) => {
      if (init.method === 'PATCH') {
        detail = cancelledReservationDetail
        return Promise.reject(new TypeError('lost acknowledgement'))
      }
      return respond(url, detail)
    })
    vi.stubGlobal('fetch', fetch)
    renderDetail()
    await confirmCancellation()
    await screen.findByRole('alert')
    expect(
      screen.getByRole('button', { name: '예약 일정 변경 준비' }).closest('fieldset'),
    ).toHaveProperty('disabled', true)
    expect(screen.queryByRole('heading', { name: '예약 취소 완료' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    expect(screen.getByText('예약 취소')).toBeTruthy()
    expect(screen.getByText('175.12')).toBeTruthy()
    expect(screen.queryByText('50%')).toBeNull()
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
  })
  it('does not replay cancellation after 401 and removes private state on redirect', async () => {
    signIn()
    const fetch = vi.fn((url: string, init: RequestInit) =>
      init.method === 'PATCH' ? Response.json({}, { status: 401 }) : respond(url),
    )
    vi.stubGlobal('fetch', fetch)
    renderDetail()
    await confirmCancellation()
    await screen.findByRole('heading', { name: '로그인' })
    expect(screen.queryByText('guest@example.com')).toBeNull()
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
    expect(fetch.mock.calls.some(([url]) => url.includes('/reissue'))).toBe(false)
  })
  it('requires fresh detail and fresh acknowledgement after a policy denial', async () => {
    signIn()
    const fetch = vi.fn((url: string, init: RequestInit) =>
      init.method === 'PATCH'
        ? Response.json(
            { status: 409, code: 'RESERVATION_009', message: '취소 마감' },
            { status: 409 },
          )
        : respond(url),
    )
    vi.stubGlobal('fetch', fetch)
    renderDetail()
    await confirmCancellation()
    expect((await screen.findByRole('alert')).textContent).toContain('RESERVATION_009')
    expect(screen.getByText('예약 확정')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '예약 취소 완료' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    fireEvent.click(await screen.findByRole('button', { name: '취소 정책 및 수수료 확인' }))
    await screen.findByText('취소 전 예상 수수료 금액: 제공되지 않음')
    expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
    expect(screen.getByRole('button', { name: '예약 취소 확정' })).toHaveProperty('disabled', true)
    expect(fetch.mock.calls.filter(([, init]) => init.method === 'PATCH')).toHaveLength(1)
  })
  it('blocks cancel while schedule change is pending or uncertain', async () => {
    signIn()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) =>
        init.method === 'PATCH' ? Promise.reject(new TypeError('lost')) : changeFlowResponse(url),
      ),
    )
    renderDetail()
    await confirmChange()
    await screen.findByRole('alert')
    expect(
      screen.getByRole('button', { name: '취소 정책 및 수수료 확인' }).closest('fieldset'),
    ).toHaveProperty('disabled', true)
  })
  it('aborts cancellation on logout and ignores late mutation success', async () => {
    signIn()
    let finish!: (response: Response) => void
    const fetch = vi.fn((url: string, init: RequestInit) =>
      init.method === 'PATCH'
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : respond(url),
    )
    vi.stubGlobal('fetch', fetch)
    renderDetail()
    await confirmCancellation()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    const signal = fetch.mock.calls.find(([, init]) => init.method === 'PATCH')![1].signal!
    act(() => clearAccessToken())
    expect(signal.aborted).toBe(true)
    await act(async () => finish(Response.json(cancellationResponse)))
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '예약 취소 완료' })).toBeNull()
  })
})
