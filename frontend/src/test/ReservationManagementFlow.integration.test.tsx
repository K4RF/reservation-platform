import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../app/routes'
import { AuthProvider } from '../state/AuthProvider'
import { setTokenPair, clearAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from './jwt'
import { reviewBooking } from './bookingFlow'
import { expectUiSemantics } from './uiSemantics'
import { accommodation } from './accommodation'
import { room, roomPage } from './room'
import {
  reservationDetail,
  changedReservationDetail,
  cancellationResponse,
  bookingRequest,
  reservationPage,
} from './reservation'
import type { ReservationDetail } from '../api/reservationDetail'

function History() {
  const navigate = useNavigate(),
    location = useLocation()
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <button onClick={() => navigate(-1)}>뒤로가기</button>
      <button onClick={() => navigate(1)}>앞으로가기</button>
    </>
  )
}
function renderAt(path = '/accommodations/7') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <History />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function signIn() {
  setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 3600), 'refresh')
}

// One server-side snapshot travels through creation, completion, list, detail, change and cancel.
// Unknown endpoints fail, so a UI-only successful transition cannot bypass its API contract.
function mockLifecycle(
  options: {
    changeCode?: string
    cancelCode?: string
    lostCancel?: boolean
  } = {},
) {
  let saved: ReservationDetail | null = null
  const cancelResult = {
    ...cancellationResponse,
    totalAmount: 550.15,
    daysBeforeCheckIn: 3,
    cancellationFeeRate: 30,
    cancellationFeeAmount: 165.05,
    estimatedRefundAmount: 385.1,
  }
  const fetch = vi.fn((url: string, init: RequestInit) => {
    const { pathname: path, searchParams: params } = new URL(url, 'http://localhost')
    if (init.method === 'POST' && path === '/api/v1/reservations') {
      expect(JSON.parse(init.body as string)).toEqual(bookingRequest)
      saved = structuredClone(reservationDetail)
      return Response.json(saved, { status: 201 })
    }
    if (init.method === 'PATCH' && path === '/api/v1/reservations/42') {
      expect(JSON.parse(init.body as string)).toEqual({
        checkInDate: '2030-01-02',
        checkOutDate: '2030-01-04',
      })
      if (options.changeCode)
        return Response.json(
          { status: 409, code: options.changeCode, message: '서버 변경 거절' },
          { status: 409 },
        )
      saved = structuredClone(changedReservationDetail)
      return Response.json(saved)
    }
    if (init.method === 'PATCH' && path === '/api/v1/reservations/42/cancel') {
      expect(init.body).toBeUndefined()
      if (options.cancelCode)
        return Response.json(
          { status: 409, code: options.cancelCode, message: '서버 취소 거절' },
          { status: 409 },
        )
      if (!saved) throw new Error('Cancellation before creation')
      saved = {
        ...saved,
        status: 'CANCELLED',
        cancelledAt: cancelResult.cancelledAt,
        cancellationFeeAmount: cancelResult.cancellationFeeAmount,
        refundAmount: cancelResult.estimatedRefundAmount,
      }
      return options.lostCancel
        ? Promise.reject(new TypeError('lost acknowledgement'))
        : Response.json(cancelResult)
    }
    if (init.method !== 'GET') throw new Error(`Unexpected method ${init.method} ${path}`)
    if (path === '/api/v1/reservations') {
      expect(params.get('page')).toBe('0')
      return Response.json(
        reservationPage({
          content: saved ? [saved] : [],
          totalElements: saved ? 1 : 0,
          totalPages: saved ? 1 : 0,
        }),
      )
    }
    if (path === '/api/v1/reservations/42') {
      return saved ? Response.json(saved) : Response.json({}, { status: 404 })
    }
    if (path === '/api/v1/accommodations/7') return Response.json(accommodation)
    if (path === '/api/v1/rooms/3') return Response.json({ ...room, nightlyPrice: 9999 })
    if (path === '/api/v1/accommodations/7/rooms') return Response.json(roomPage())
    if (path === '/api/v1/accommodations/7/rooms/available') {
      // Shared occupied dates can exclude this room from ordinary NEW-booking availability.
      return Response.json(
        saved ? roomPage({ content: [], totalElements: 0, totalPages: 0 }) : roomPage(),
      )
    }
    if (path.startsWith('/api/v1/rooms/3/prices/')) {
      const date = path.slice(-10),
        daily = date === '2030-01-01'
      return Response.json({
        roomId: 3,
        stayDate: date,
        nightlyPrice: daily ? 100.1 : date === '2030-01-02' ? 250.15 : 300,
        source: daily ? 'DAILY' : 'DEFAULT',
        roomDailyPriceId: daily ? 9 : null,
      })
    }
    throw new Error(`Unexpected API ${init.method} ${path}`)
  })
  vi.stubGlobal('fetch', fetch)
  return {
    fetch,
    options,
    get saved() {
      return saved
    },
    cancelResult,
  }
}

async function createAndOpenDetail() {
  await reviewBooking('350.25')
  fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
  await screen.findByText('예약이 확정되었습니다.')
  fireEvent.click(screen.getByRole('link', { name: '내 예약' }))
  fireEvent.click(await screen.findByRole('link', { name: '예약 42 상세 보기' }))
  await screen.findByText('guest@example.com')
}
async function prepareChange() {
  fireEvent.click(screen.getByRole('button', { name: '예약 일정 변경 준비' }))
  fireEvent.change(screen.getByLabelText('새 체크인'), { target: { value: '2030-01-02' } })
  fireEvent.change(screen.getByLabelText('새 체크아웃'), { target: { value: '2030-01-04' } })
  fireEvent.submit(screen.getByRole('form', { name: '예약 변경 날짜 조건' }))
  await screen.findByText('현재 객실이 일반 신규 예약 가능 목록에 없습니다.')
  fireEvent.click(screen.getByRole('button', { name: '일정 변경 내용 확인' }))
  await screen.findByText('새 일정 참고 예상 총액: 550.15')
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: '예약 일정 변경 확정' }))
}
async function changeAndReviewCancel() {
  await prepareChange()
  await screen.findByText('첫 숙박일 요금 Snapshot: 250.15')
  fireEvent.click(screen.getByRole('button', { name: '취소 정책 및 수수료 확인' }))
  await screen.findByText('취소 전 예상 수수료 금액: 제공되지 않음')
  const panel = screen.getByRole('region', { name: '취소 전 확인' })
  expect(within(panel).getByText('저장된 예약 총액: 550.15')).toBeTruthy()
  fireEvent.click(within(panel).getByRole('checkbox'))
  return within(panel).getByRole('button', { name: '예약 취소 확정' })
}
const writes = (mock: ReturnType<typeof mockLifecycle>['fetch']) =>
  mock.mock.calls.filter(([, init]) => init.method !== 'GET')

describe('Reservation Management lifecycle through real UI/router/auth/API client (HTTP mocks)', () => {
  it('connects booking creation → owner list/detail → change despite ordinary absence → stored policy → cancel → refreshed list and history', async () => {
    signIn()
    const api = mockLifecycle()
    renderAt()
    await createAndOpenDetail()
    expect(screen.getByText('예약 확정')).toBeTruthy()
    expectUiSemantics()
    expect(screen.getByText('350.25')).toBeTruthy()
    expect(screen.getByRole('heading', { name: accommodation.name })).toBeTruthy()
    const cancel = await changeAndReviewCancel()
    expectUiSemantics()
    expect(
      within(screen.getByRole('region', { name: '취소 전 확인' })).getByText(
        '체크인 7일 전 이상: 무료 취소',
      ),
    ).toBeTruthy()
    expect(screen.getByText('취소 전 예상 환불 금액: 제공되지 않음')).toBeTruthy()
    expect(writes(api.fetch)).toHaveLength(2)
    fireEvent.click(cancel)
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    expect(screen.getByText('예약 취소')).toBeTruthy()
    expectUiSemantics()
    expect(api.saved?.refundAmount).toBe(385.1)
    const feedback = screen.getByRole('region', { name: '예약 취소 완료' })
    expect(within(feedback).getByText('30%')).toBeTruthy()
    expect(within(feedback).getByText('165.05')).toBeTruthy()
    expect(within(feedback).getByText('385.10')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '예약 일정 변경 준비' })).toBeNull()
    expect(screen.queryByRole('button', { name: '취소 정책 및 수수료 확인' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: '내 예약 목록으로' }))
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    expectUiSemantics()
    expect(screen.getByText('예약 취소')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    expect(screen.queryByRole('heading', { name: '예약 취소 완료' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '앞으로가기' }))
    await screen.findByRole('link', { name: '예약 42 상세 보기' })
    expect(writes(api.fetch).map(([, init]) => init.method)).toEqual(['POST', 'PATCH', 'PATCH'])
    for (const [url, init] of api.fetch.mock.calls)
      expect(new Headers(init.headers).has('Authorization')).toBe(url.includes('/reservations'))
    expect(api.fetch.mock.calls.some(([url]) => /preview|quote|\/admin/.test(url))).toBe(false)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
  it.each(['INVENTORY_011', 'BOOKING_POLICY_005'])(
    'keeps created snapshots after change %s and history navigation never replays mutation',
    async (code) => {
      signIn()
      const api = mockLifecycle({ changeCode: code })
      renderAt()
      await createAndOpenDetail()
      await prepareChange()
      expect((await screen.findByRole('alert')).textContent).toContain(code)
      expect(screen.getByText('첫 숙박일 요금 Snapshot: 100.10')).toBeTruthy()
      expect(api.saved?.checkInDate).toBe(bookingRequest.checkInDate)
      fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
      await screen.findByRole('link', { name: '예약 42 상세 보기' })
      fireEvent.click(screen.getByRole('button', { name: '앞으로가기' }))
      await screen.findByText('guest@example.com')
      expect(writes(api.fetch)).toHaveLength(2)
      expect(screen.queryByRole('checkbox')).toBeNull()
    },
  )
  it('does not cancel automatically after successful change and policy denial preserves CONFIRMED', async () => {
    signIn()
    const api = mockLifecycle({ cancelCode: 'RESERVATION_009' })
    renderAt()
    await createAndOpenDetail()
    const cancel = await changeAndReviewCancel()
    expect(writes(api.fetch)).toHaveLength(2)
    fireEvent.click(cancel)
    expect((await screen.findByRole('alert')).textContent).toContain('RESERVATION_009')
    expect(api.saved?.status).toBe('CONFIRMED')
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    await screen.findByText('첫 숙박일 요금 Snapshot: 250.15')
    expect(screen.getByText('예약 확정')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '예약 취소 완료' })).toBeNull()
    expect(writes(api.fetch)).toHaveLength(3)
  })
  it('confirms lost cancel acknowledgement with GET after the complete lifecycle without a second PATCH', async () => {
    signIn()
    const api = mockLifecycle({ lostCancel: true })
    renderAt()
    await createAndOpenDetail()
    fireEvent.click(await changeAndReviewCancel())
    expect((await screen.findByRole('alert')).textContent).toContain('서버에서 이미 취소됐을 수')
    fireEvent.click(screen.getByRole('button', { name: '예약 상세 다시 조회' }))
    await screen.findByRole('heading', { name: '저장된 취소 결과' })
    expect(screen.getByText('385.10')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '예약 취소 완료' })).toBeNull()
    expect(writes(api.fetch)).toHaveLength(3)
  })
  it('re-mounts a protected detail after reload with lost memory auth and no mutation or private GET', async () => {
    signIn()
    const api = mockLifecycle()
    const view = renderAt()
    await createAndOpenDetail()
    const before = api.fetch.mock.calls.length
    view.unmount()
    act(() => clearAccessToken()) // Full module-reload token loss is covered separately by SessionReload.test.ts.
    renderAt('/reservations/42')
    expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(api.fetch.mock.calls).toHaveLength(before)
    expect(screen.queryByText('guest@example.com')).toBeNull()
  })
})
