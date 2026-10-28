import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../app/routes'
import { AuthProvider } from '../state/AuthProvider'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from './jwt'
import { accommodation, accommodationPage } from './accommodation'
import { room, roomPage } from './room'
import { mockDialog } from './dialog'
import { expectUiSemantics } from './uiSemantics'
import { bookingRequest, reservationResult } from './reservation'
import { selectBookingRoom as selectRoom, reviewBooking as reachReview } from './bookingFlow'

mockDialog()

function Location() {
  const location = useLocation()
  const navigate = useNavigate()
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
        <Location />
      </MemoryRouter>
    </AuthProvider>,
  )
}
function mockApi(
  rejectFirst = false,
  options: {
    emptyAvailability?: boolean
    mixedPrices?: boolean
    create?: () => Promise<Response>
  } = {},
) {
  let attempts = 0
  const mock = vi.fn((url: string, init: RequestInit) => {
    const parsed = new URL(url, 'http://localhost')
    const path = parsed.pathname
    if (init.method === 'POST' && path === '/api/v1/auth/login')
      return Promise.resolve(
        Response.json({
          accessToken: accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60),
          refreshToken: 'refresh',
          tokenType: 'Bearer',
        }),
      )
    if (init.method === 'POST' && path === '/api/v1/reservations') {
      attempts++
      if (options.create) return options.create()
      if (rejectFirst && attempts === 1)
        return Promise.resolve(
          Response.json(
            {
              status: 400,
              code: 'COMMON_001',
              message: '입력 오류',
              errors: [{ field: 'representativeGuest.email', message: '이메일 확인' }],
            },
            { status: 400 },
          ),
        )
      return Promise.resolve(Response.json(reservationResult, { status: 201 }))
    }
    if (init.method !== 'GET') throw new Error(`Unexpected method: ${init.method} ${path}`)
    if (path === '/api/v1/reservations/42') return Promise.resolve(Response.json(reservationResult))
    if (path === '/api/v1/rooms/3') return Promise.resolve(Response.json(room))
    if (path.startsWith('/api/v1/rooms/3/prices/')) {
      const daily = options.mixedPrices && path.endsWith('2030-01-01')
      return Promise.resolve(
        Response.json({
          roomDailyPriceId: daily ? 9 : null,
          roomId: 3,
          stayDate: url.slice(-10),
          nightlyPrice: options.mixedPrices ? (daily ? 180000.55 : 100000.1) : 100,
          source: daily ? 'DAILY' : 'DEFAULT',
        }),
      )
    }
    if (path === '/api/v1/accommodations/7/rooms/available')
      return Promise.resolve(
        Response.json(
          options.emptyAvailability
            ? roomPage({ content: [], totalElements: 0, totalPages: 0 })
            : roomPage(),
        ),
      )
    if (path === '/api/v1/accommodations/7/rooms') return Promise.resolve(Response.json(roomPage()))
    if (path === '/api/v1/accommodations/7') return Promise.resolve(Response.json(accommodation))
    if (path === '/api/v1/accommodations') {
      const page = Number(parsed.searchParams.get('page') ?? 0)
      return Promise.resolve(
        Response.json(
          accommodationPage({
            page,
            size: Number(parsed.searchParams.get('size') ?? 20),
            totalPages: 2,
            totalElements: 11,
            first: page === 0,
            last: page === 1,
          }),
        ),
      )
    }
    throw new Error(`Unexpected API request: ${init.method} ${path}`)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
async function searchToDetail() {
  fireEvent.click(await screen.findByRole('link', { name: '서울 호텔' }))
  await screen.findByRole('heading', { name: '서울 호텔', level: 1 })
  await screen.findByLabelText('숙박 체크인')
}
describe('authenticated booking creation flow (HTTP boundary mocks)', () => {
  it('preserves edited stay/room hints on Back from login but rechecks availability without restoring guest data or writing', async () => {
    const mock = mockApi()
    renderAt('/accommodations?city=서울특별시&page=1&sortBy=NAME')
    await searchToDetail()
    await selectRoom()
    fireEvent.click(screen.getByRole('button', { name: '예약하려면 로그인' }))
    await screen.findByRole('heading', { name: '로그인' })
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    await screen.findByRole('status', { name: '선택한 객실' })
    const restored = new URL(screen.getByTestId('location').textContent!, 'http://localhost')
    expect(restored.searchParams.get('checkInDate')).toBe('2030-01-01')
    expect(restored.searchParams.get('checkOutDate')).toBe('2030-01-03')
    expect(restored.searchParams.get('guestCount')).toBe('2')
    expect(restored.searchParams.get('roomId')).toBe('3')
    expect(new URLSearchParams(restored.searchParams.get('search')!).get('page')).toBe('1')
    expect(mock.mock.calls.filter(([url]) => url.includes('/rooms/available?'))).toHaveLength(2)
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
  })
  it('connects Home search, filter/page navigation, room detail and a fresh selection after login before creating one reservation', async () => {
    const mock = mockApi()
    renderAt('/')
    expectUiSemantics()
    fireEvent.change(screen.getByLabelText('어디로 떠나세요?'), { target: { value: '서울특별시' } })
    fireEvent.change(screen.getByLabelText('체크인', { exact: true }), {
      target: { value: '2030-01-01' },
    })
    fireEvent.change(screen.getByLabelText('체크아웃', { exact: true }), {
      target: { value: '2030-01-03' },
    })
    fireEvent.click(screen.getByRole('button', { name: '인원 1명 늘리기' }))
    expect(mock).not.toHaveBeenCalled()
    fireEvent.submit(screen.getByRole('form', { name: '여행 검색' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    expectUiSemantics()
    const homeQuery = new URL(mock.mock.calls[0][0], 'http://localhost').searchParams
    expect(homeQuery.get('checkInDate')).toBe('2030-01-01')
    expect(homeQuery.get('checkOutDate')).toBe('2030-01-03')
    expect(homeQuery.get('guestCount')).toBe('2')
    fireEvent.click(screen.getByText('상세 검색 필터'))
    fireEvent.change(screen.getByLabelText('정렬', { exact: true }), { target: { value: 'NAME' } })
    fireEvent.change(screen.getByLabelText('정렬 방향'), { target: { value: 'DESC' } })
    fireEvent.change(screen.getByLabelText('페이지 크기'), { target: { value: '10' } })
    fireEvent.submit(screen.getByRole('form', { name: '숙소 검색 조건' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    fireEvent.click(
      within(screen.getByRole('navigation', { name: '숙소 페이지' })).getByRole('button', {
        name: '다음',
      }),
    )
    await waitFor(() =>
      expect(
        new URL(screen.getByTestId('location').textContent!, 'http://localhost').searchParams.get(
          'page',
        ),
      ).toBe('1'),
    )
    await searchToDetail()
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    await screen.findByText('총 예상 금액: 200.00')
    const available = screen.getByRole('list', { name: '예약 가능한 객실 목록' })
    fireEvent.click(within(available).getByRole('button', { name: '스탠다드 상세 보기' }))
    await screen.findByRole('button', { name: '이 객실 선택' })
    fireEvent.click(screen.getByRole('button', { name: '객실 상세 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('status', { name: '선택한 객실' })).toBeTruthy()
    fireEvent.click(within(available).getByRole('button', { name: '스탠다드 상세 보기' }))
    fireEvent.click(await screen.findByRole('button', { name: '이 객실 선택' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
    expect(
      mock.mock.calls.every(([, init]) => !new Headers(init.headers).has('Authorization')),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '예약하려면 로그인' }))
    await screen.findByRole('heading', { name: '로그인' })
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'member@example.com' } })
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'password123!' } })
    fireEvent.click(screen.getByRole('button', { name: '로그인' }))
    await screen.findByRole('form', { name: '대표 투숙객 정보' })
    expectUiSemantics()
    const returned = new URL(screen.getByTestId('location').textContent!, 'http://localhost')
    expect(returned.pathname).toBe('/accommodations/7')
    expect([...returned.searchParams.keys()].sort()).toEqual(
      ['checkInDate', 'checkOutDate', 'guestCount', 'roomId', 'search'].sort(),
    )
    expect(returned.searchParams.get('checkInDate')).toBe('2030-01-01')
    expect(returned.searchParams.get('checkOutDate')).toBe('2030-01-03')
    expect(returned.searchParams.get('guestCount')).toBe('2')
    expect(returned.searchParams.get('roomId')).toBe('3')
    const original = new URLSearchParams(returned.searchParams.get('search')!)
    expect(original.get('page')).toBe('1')
    expect(original.get('sortBy')).toBe('NAME')
    expect(original.get('city')).toBe('서울특별시')
    expect(screen.getByRole('link', { name: '숙소 검색으로 돌아가기' }).getAttribute('href')).toBe(
      '/accommodations?' + original,
    )
    expect(mock.mock.calls.filter(([url]) => url.includes('/rooms/available?'))).toHaveLength(2)
    expect(screen.queryByRole('link', { name: '로그인' })).toBeNull()
    expect(screen.queryByRole('link', { name: '회원가입' })).toBeNull()
    expect(screen.getByRole('link', { name: '내 예약' })).toBeTruthy()
    for (const [label, value] of [
      ['대표 투숙객 이름', bookingRequest.representativeGuest.name],
      ['대표 투숙객 이메일', bookingRequest.representativeGuest.email],
      ['대표 투숙객 연락처', bookingRequest.representativeGuest.phone],
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.submit(screen.getByRole('form', { name: '대표 투숙객 정보' }))
    await screen.findByText('총 예상 금액: 200.00')
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await screen.findByText('예약이 확정되었습니다.')
    expectUiSemantics()
    const creates = mock.mock.calls.filter(
      ([url, init]) => url.endsWith('/reservations') && init.method === 'POST',
    )
    expect(creates).toHaveLength(1)
    expect(new Headers(creates[0][1].headers).get('Authorization')).toMatch(/^Bearer /)
    expect(JSON.parse(creates[0][1].body as string)).toEqual(bookingRequest)
  })
  it('keeps booking input closed for an unknown role while allowing public exploration', async () => {
    const mock = mockApi()
    setTokenPair(
      accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60, 'ACCESS', 'SUPERUSER'),
      'refresh',
    )
    renderAt()
    await selectRoom()
    expect(screen.getByRole('button', { name: '예약하려면 로그인' })).toBeTruthy()
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
    expect(mock.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it('does not restore a room that became unavailable during login', async () => {
    mockApi(false, { emptyAvailability: true })
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    renderAt(
      '/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2&roomId=3',
    )
    await screen.findByText(
      '이전에 선택한 객실은 현재 조건에서 이용할 수 없습니다. 다른 객실을 선택하세요.',
    )
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
  })
  it('shows loading and disables repeated POST submission throughout the authenticated search flow', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    let resolve!: (response: Response) => void
    const mock = mockApi(false, {
      create: () =>
        new Promise<Response>((next) => {
          resolve = next
        }),
    })
    renderAt('/accommodations')
    await searchToDetail()
    await reachReview()
    const button = screen.getByRole('button', { name: '예약 생성' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() =>
      expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1),
    )
    expect(screen.getByText('예약을 생성하고 있습니다. 중복 제출하지 마세요.')).toBeTruthy()
    expect((button as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: '투숙객 정보 수정' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await act(async () => {
      resolve(Response.json(reservationResult, { status: 201 }))
    })
    await screen.findByText('예약이 확정되었습니다.')
    expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
  })
  it('connects search URL restoration and pagination through detail, mixed prices, booking and server completion', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = mockApi(false, { mixedPrices: true })
    renderAt('/accommodations?name=호텔&city=서울특별시&page=0&size=10')
    expect(screen.getByText('숙소를 불러오고 있습니다.')).toBeTruthy()
    await screen.findByRole('link', { name: '서울 호텔' })
    expect((screen.getByLabelText('숙소명') as HTMLInputElement).value).toBe('호텔')
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByText('2 / 2 페이지')
    await searchToDetail()
    expect(await screen.findByRole('heading', { name: '스탠다드' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    await screen.findByText('2 / 2 페이지')
    expect((screen.getByLabelText('도시 (정확한 이름)') as HTMLInputElement).value).toBe(
      '서울특별시',
    )
    fireEvent.click(screen.getByRole('button', { name: '앞으로가기' }))
    await reachReview('280,000.65')
    expect(screen.getByText('날짜별 요금')).toBeTruthy()
    expect(screen.getByText('기본 요금')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await screen.findByText('예약이 확정되었습니다.')
    expect(screen.getByText(`예약 번호: ${reservationResult.reservationNumber}`)).toBeTruthy()
    expect(screen.getByText('예약 금액 Snapshot: 350.25')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('/reservations/42/complete')
    const calls = mock.mock.calls
    expect(calls.filter(([url]) => url.includes('/prices/'))).toHaveLength(2)
    expect(calls.some(([url]) => url.includes('/prices/2030-01-03'))).toBe(false)
    const availability = new URL(
      calls.find(([url]) => url.includes('/rooms/available?'))![0],
      'http://localhost',
    ).searchParams
    expect(availability.get('guestCount')).toBe('2')
    expect(availability.get('checkInDate')).toBe(bookingRequest.checkInDate)
    expect(calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    await screen.findByText('2 / 2 페이지')
    expect(screen.queryByText('제출 전 최종 확인')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '앞으로가기' }))
    await screen.findByText('예약이 확정되었습니다.')
    expect(calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
  })
  it.each(['INVENTORY_005', 'INVENTORY_011', 'BOOKING_POLICY_005'])(
    'retains input without automatic POST replay after integrated %s rejection',
    async (code) => {
      setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
      const mock = mockApi(false, {
        create: () =>
          Promise.resolve(
            Response.json(
              { status: 409, code, message: '예약 조건 또는 재고 충돌' },
              { status: 409 },
            ),
          ),
      })
      renderAt('/accommodations')
      await searchToDetail()
      await reachReview()
      fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain('가용 객실을 다시 조회'),
      )
      expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
      expect(screen.queryByText('예약이 확정되었습니다.')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: '투숙객 정보 수정' }))
      expect((screen.getByLabelText('대표 투숙객 연락처') as HTMLInputElement).value).toBe(
        bookingRequest.representativeGuest.phone,
      )
    },
  )
  it('prevents selecting an ordinary listed room when availability is empty', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = mockApi(false, { emptyAvailability: true })
    renderAt('/accommodations')
    await searchToDetail()
    fireEvent.change(screen.getByLabelText('숙박 체크인'), {
      target: { value: bookingRequest.checkInDate },
    })
    fireEvent.change(screen.getByLabelText('숙박 체크아웃'), {
      target: { value: bookingRequest.checkOutDate },
    })
    fireEvent.submit(screen.getByRole('form', { name: '객실 가용성 조건' }))
    await screen.findByText('선택한 조건에 예약 가능한 객실이 없습니다.')
    expect(screen.getByRole('heading', { name: '스탠다드' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '스탠다드 선택' })).toBeNull()
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
    expect(mock.mock.calls.some(([url]) => url.includes('/prices/'))).toBe(false)
    expect(mock.mock.calls.some(([, init]) => init.method === 'POST')).toBe(false)
  })
  it('keeps an ambiguous network failure out of completion and prevents another submit', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = mockApi(false, { create: () => Promise.reject(new TypeError('offline')) })
    renderAt('/accommodations')
    await searchToDetail()
    const draftPath = screen.getByTestId('location').textContent
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        '예약 생성 여부를 확인할 수 없습니다',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
    expect(screen.getByTestId('location').textContent).toBe(draftPath)
    expect(new URL(draftPath!, 'http://localhost').pathname).toBe('/accommodations/7')
  })
  it('creates once, replaces draft route, and displays backend amount rather than estimate', async () => {
    const token = accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60)
    setTokenPair(token, 'refresh')
    const mock = mockApi()
    renderAt()
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await screen.findByText('예약이 확정되었습니다.')
    expect(screen.getByTestId('location').textContent).toBe('/reservations/42/complete')
    expect(screen.getByText('예약 금액 Snapshot: 350.25')).toBeTruthy()
    expect(screen.queryByRole('form', { name: '대표 투숙객 정보' })).toBeNull()
    const posts = mock.mock.calls.filter(([, init]) => init.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0][1].body as string)).toEqual(bookingRequest)
    expect(new Headers(posts[0][1].headers).get('Authorization')).toBe(`Bearer ${token}`)
  })
  it('preserves guest values on validation failure and only retries after explicit action', async () => {
    setTokenPair(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60), 'refresh')
    const mock = mockApi(true)
    renderAt()
    await reachReview()
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'representativeGuest.email: 이메일 확인',
      ),
    )
    expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '투숙객 정보 수정' }))
    expect((screen.getByLabelText('대표 투숙객 이름') as HTMLInputElement).value).toBe('홍길동')
    fireEvent.submit(screen.getByRole('form', { name: '대표 투숙객 정보' }))
    fireEvent.click(screen.getByRole('button', { name: '예약 생성' }))
    await screen.findByText('예약이 확정되었습니다.')
    expect(mock.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(2)
  })
  it.each(['/reservations/42/complete'])(
    'requires login on direct %s access and sends no reservation requests',
    (path) => {
      const mock = mockApi()
      renderAt(path)
      expect(screen.getByRole('heading', { name: '로그인' })).toBeTruthy()
      expect(mock).not.toHaveBeenCalled()
    },
  )
})
