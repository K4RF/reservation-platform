import * as searchLayers from '../test/searchLayers'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccommodationDetailPage } from './AccommodationDetailPage'
import { accommodation } from '../test/accommodation'
import { roomPage } from '../test/room'
import { media } from '../test/media'
import { AuthProvider } from '../state/AuthProvider'
import { bookingPolicy } from '../test/adminAccommodation'

const policyResponse = { ...bookingPolicy, bookingPolicyId: 5, accommodationId: 7 }

function NavigateDetail() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/accommodations/8')}>다른 숙소</button>
}
function renderAt(path = '/accommodations/7') {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <NavigateDetail />
        <Routes>
          <Route path="/accommodations/:accommodationId" element={<AccommodationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}
function mockApi() {
  const fetchMock = vi.fn().mockImplementation((url: string) =>
    url.endsWith('/booking-policy')
      ? Promise.resolve(new Response(null, { status: 204 }))
      : Promise.resolve(
          Response.json(
            url.includes('/rooms?')
              ? roomPage({
                  page: Number(new URL(url, 'http://localhost').searchParams.get('page')),
                })
              : accommodation,
          ),
        ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AccommodationDetailPage with the real API client', () => {
  it.each([
    'checkInDate=2030-01-01&checkInDate=2030-01-02&checkOutDate=2030-01-03',
    'checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=0',
    'checkInDate=2030-01-01&checkOutDate=2030-01-03&accessToken=secret',
    'search=page%3D1&search=page%3D2',
  ])(
    'rejects invalid detail context %s without an automatic availability request',
    async (query) => {
      const mock = mockApi()
      renderAt('/accommodations/7?' + query)
      await screen.findByRole('heading', { name: '서울 호텔' })
      expect(screen.getByRole('alert').textContent).toContain('올바르지 않은 탐색 조건')
      expect(searchLayers.committedDateInput('숙박 체크인')).toHaveProperty('value', '')
      expect(mock.mock.calls.every(([url]) => !url.includes('/rooms/available'))).toBe(true)
      expect(
        screen.getByRole('link', { name: '숙소 검색으로 돌아가기' }).getAttribute('href'),
      ).toBe('/accommodations')
    },
  )
  it('connects the availability query and room selection to the detail page', async () => {
    const mock = mockApi()
    const images = [media(), media(2, 1)]
    mock.mockImplementation((url: string) =>
      url.endsWith('/booking-policy')
        ? Promise.reject(new TypeError('offline'))
        : Promise.resolve(
            Response.json(
              url.includes('/rooms')
                ? roomPage()
                : { ...accommodation, representativeImage: images[0], images },
            ),
          ),
    )
    renderAt()
    await screen.findByRole('heading', { name: '서울 호텔' })
    await screen.findByRole('heading', { name: '스탠다드' })
    expect(await screen.findByText('예약 정책을 불러오지 못했습니다.')).toBeTruthy()
    searchLayers.editStayDate('숙박 체크인', '2030-01-01')
    searchLayers.editStayDate('숙박 체크아웃', '2030-01-02')
    fireEvent.submit(screen.getByRole('form', { name: '객실 가용성 조건' }))
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    expect(screen.queryByRole('list', { name: '객실 목록' })).toBeNull()
    expect(screen.getAllByRole('heading', { name: '스탠다드' })).toHaveLength(1)
    expect(screen.getByRole('status', { name: '선택한 객실' })).toBeTruthy()
    const before = mock.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '숙소 사진 2장 보기' }))
    fireEvent.error(screen.getByRole('dialog').querySelector('img')!)
    fireEvent.click(screen.getByRole('button', { name: '숙소 사진 전체 보기 닫기' }))
    expect(screen.getByRole('status', { name: '선택한 객실' })).toBeTruthy()
    expect(mock).toHaveBeenCalledTimes(before)
    expect(mock.mock.calls.some(([url]) => url.includes('/rooms/available?'))).toBe(true)
    searchLayers.stepGuests('숙박 인원', true)
    expect(screen.queryByRole('status', { name: '선택한 객실' })).toBeNull()
    expect(screen.queryByRole('list', { name: '예약 가능한 객실 목록' })).toBeNull()
    await screen.findByRole('list', { name: '객실 목록' })
    expect(mock.mock.calls.filter(([url]) => url.includes('/rooms/available?'))).toHaveLength(1)
  })
  it('keeps an inactive accommodation read-only even with an incoming stay/room hint', async () => {
    const mock = mockApi()
    mock.mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.includes('/rooms?') ? roomPage() : { ...accommodation, status: 'INACTIVE' },
        ),
      ),
    )
    renderAt(
      '/accommodations/7?checkInDate=2030-01-01&checkOutDate=2030-01-03&guestCount=2&roomId=3',
    )
    await screen.findByRole('list', { name: '객실 목록' })
    expect(screen.getByText(/운영 중지 숙소입니다/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '스탠다드 선택' })).toBeNull()
    expect(mock.mock.calls.every(([url]) => !url.includes('/available'))).toBe(true)
  })
  it('loads operating facts and unconfigured policy without using any cancellation-policy GET', async () => {
    const fetchMock = mockApi()
    renderAt()
    expect(screen.getByText('숙소 상세를 불러오고 있습니다.')).toBeTruthy()
    await screen.findByRole('heading', { name: '서울 호텔' })
    await screen.findByRole('heading', { name: '스탠다드' })
    expect(screen.getByText('편안한 숙소')).toBeTruthy()
    expect(screen.getByText('대한민국 서울특별시 강남구 테헤란로 1')).toBeTruthy()
    expect(screen.getByText('15:00:00')).toBeTruthy()
    expect(screen.getByText('11:00:00')).toBeTruthy()
    expect(screen.getByText('Asia/Seoul')).toBeTruthy()
    expect(await screen.findByText('설정된 예약 정책이 없습니다.')).toBeTruthy()
    expect(screen.getByText('숙소 사진 미제공')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('button', { name: /사진.*보기/ })).toBeNull()
    for (const [name, id] of [
      ['숙소 소개', 'accommodation-introduction'],
      ['객실 선택', 'room-list-title'],
      ['이용 안내', 'accommodation-operating-info'],
    ]) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toBe('#' + id)
      expect(document.getElementById(id)?.tabIndex).toBe(-1)
    }
    fireEvent.click(screen.getByRole('link', { name: '객실 선택' }))
    // An in-page CTA only moves to the existing query controls; it never queries/selects/writes.
    expect(fetchMock.mock.calls.every(([url]) => !url.includes('/rooms/available'))).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/cancellation-policy'))).toBe(false)
  })
  it('keeps a policy 404 local and retries just the read using stored limits, not computed dates', async () => {
    let reads = 0
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/booking-policy')
          ? ++reads === 1
            ? new Response(null, { status: 404 })
            : Response.json(policyResponse)
          : Response.json(
              url.includes('/rooms?')
                ? roomPage()
                : { ...accommodation, timeZone: 'America/New_York' },
            ),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    renderAt()
    const policyRegion = await screen.findByRole('region', { name: '예약 정책' })
    const policy = within(policyRegion)
    await policy.findByText('예약 정책을 조회할 숙소를 찾을 수 없습니다.')
    expect(screen.getByRole('heading', { name: '서울 호텔' })).toBeTruthy()
    expect(screen.getByText('America/New_York')).toBeTruthy()
    fireEvent.click(policy.getByRole('button', { name: '다시 시도' }))
    expect(await policy.findByText(/최소 1박/)).toBeTruthy()
    expect(document.activeElement).toBe(policyRegion)
    expect(policy.getByText('사전 예약일은 숙소 현지 날짜 기준입니다.')).toBeTruthy()
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/booking-policy'))).toHaveLength(2)
    expect(fetch.mock.calls.filter(([url]) => url.includes('/rooms?'))).toHaveLength(1)
  })
  it('aborts late policy reads and does not display another property’s policy on navigation', async () => {
    let finish!: (response: Response) => void
    let signal: AbortSignal | null | undefined
    const fetch = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith('/7/booking-policy')) {
        signal = init.signal
        return new Promise<Response>((resolve) => {
          finish = resolve
        })
      }
      if (url.endsWith('/8/booking-policy'))
        return Promise.resolve(new Response(null, { status: 204 }))
      if (url.includes('/rooms?')) return Promise.resolve(Response.json(roomPage({ content: [] })))
      return Promise.resolve(
        Response.json(
          url.endsWith('/8')
            ? { ...accommodation, accommodationId: 8, name: '다른 호텔' }
            : accommodation,
        ),
      )
    })
    vi.stubGlobal('fetch', fetch)
    renderAt()
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    fireEvent.click(screen.getByRole('button', { name: '다른 숙소' }))
    await screen.findByText('설정된 예약 정책이 없습니다.')
    expect(signal?.aborted).toBe(true)
    await act(async () => finish(Response.json(policyResponse)))
    expect(screen.queryByText(/최소 1박/)).toBeNull()
    expect(screen.getByRole('heading', { name: '다른 호텔' })).toBeTruthy()
  })
  it('does not guess legacy location or missing check-in/out times', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            url.includes('/rooms?')
              ? roomPage({ content: [] })
              : {
                  ...accommodation,
                  country: null,
                  city: null,
                  region: null,
                  checkInTime: null,
                  checkOutTime: null,
                },
          ),
        ),
      ),
    )
    renderAt()
    await screen.findAllByText('테헤란로 1')
    expect(screen.getAllByText('등록되지 않음')).toHaveLength(2)
    await screen.findByText('등록된 객실이 없습니다.')
  })
  it('shows not found and does not request rooms for a missing accommodation', async () => {
    const mock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { status: 404, code: 'ACCOMMODATION_001', message: 'missing' },
          { status: 404 },
        ),
      )
    vi.stubGlobal('fetch', mock)
    renderAt()
    await screen.findByRole('heading', { name: '숙소를 찾을 수 없습니다.' })
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it.each(['abc', '0', '-1', '9007199254740992'])(
    'rejects invalid ID %s before requesting',
    (id) => {
      const mock = vi.fn()
      vi.stubGlobal('fetch', mock)
      renderAt('/accommodations/' + id)
      expect(screen.getByRole('heading', { name: '올바르지 않은 숙소 ID입니다.' })).toBeTruthy()
      expect(mock).not.toHaveBeenCalled()
    },
  )
  it('retries detail failures', async () => {
    const mock = mockApi()
    mock.mockRejectedValueOnce(new TypeError('offline'))
    renderAt()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('heading', { name: '서울 호텔' })
  })
  it('keeps accommodation info visible when rooms fail and retries only rooms', async () => {
    const mock = mockApi()
    mock
      .mockImplementationOnce(() => Promise.resolve(Response.json(accommodation)))
      .mockRejectedValueOnce(new TypeError('offline'))
    renderAt()
    await screen.findByRole('alert')
    expect(screen.getByRole('heading', { name: '서울 호텔' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('heading', { name: '스탠다드' })
    expect(mock.mock.calls.filter(([url]) => url.endsWith('/accommodations/7'))).toHaveLength(1)
  })
  it('paginates rooms without reloading accommodation details', async () => {
    const mock = mockApi()
    mock
      .mockImplementationOnce(() => Promise.resolve(Response.json(accommodation)))
      .mockImplementationOnce(() =>
        Promise.resolve(Response.json(roomPage({ totalPages: 2, last: false }))),
      )
    renderAt()
    await screen.findByRole('heading', { name: '스탠다드' })
    fireEvent.click(screen.getByRole('button', { name: '다음 객실' }))
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(4))
    expect(mock.mock.calls.at(-1)![0]).toContain('page=1')
    await screen.findByRole('heading', { name: '스탠다드' })
    expect(mock.mock.calls.filter(([url]) => url.endsWith('/accommodations/7'))).toHaveLength(1)
  })
  it('ignores old detail responses after route navigation', async () => {
    let resolveOld!: (response: Response) => void
    const mock = mockApi()
    mock
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValueOnce(
        Response.json({ ...accommodation, accommodationId: 8, name: '새 숙소' }),
      )
      .mockResolvedValueOnce(Response.json(roomPage({ content: [], totalElements: 0 })))
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: '다른 숙소' }))
    await screen.findByRole('heading', { name: '새 숙소' })
    resolveOld(Response.json(accommodation))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '서울 호텔' })).toBeNull())
  })
})
