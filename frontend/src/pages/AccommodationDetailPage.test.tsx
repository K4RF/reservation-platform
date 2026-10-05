import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccommodationDetailPage } from './AccommodationDetailPage'
import { accommodation } from '../test/accommodation'
import { roomPage } from '../test/room'

function NavigateDetail() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/accommodations/8')}>다른 숙소</button>
}
function renderAt(path = '/accommodations/7') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavigateDetail />
      <Routes>
        <Route path="/accommodations/:accommodationId" element={<AccommodationDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
function mockApi() {
  const fetchMock = vi
    .fn()
    .mockImplementation((url: string) =>
      Promise.resolve(
        Response.json(
          url.includes('/rooms?')
            ? roomPage({ page: Number(new URL(url, 'http://localhost').searchParams.get('page')) })
            : accommodation,
        ),
      ),
    )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AccommodationDetailPage with the real API client', () => {
  it('connects the availability query and room selection to the detail page', async () => {
    const mock = mockApi()
    mock.mockImplementation((url: string) =>
      Promise.resolve(Response.json(url.includes('/rooms') ? roomPage() : accommodation)),
    )
    renderAt()
    await screen.findByRole('heading', { name: '서울 호텔' })
    await screen.findByRole('heading', { name: '스탠다드' })
    fireEvent.change(screen.getByLabelText('숙박 체크인'), { target: { value: '2030-01-01' } })
    fireEvent.change(screen.getByLabelText('숙박 체크아웃'), { target: { value: '2030-01-02' } })
    fireEvent.submit(screen.getByRole('form', { name: '객실 가용성 조건' }))
    fireEvent.click(await screen.findByRole('button', { name: '스탠다드 선택' }))
    expect(screen.getByRole('status', { name: '선택한 객실' })).toBeTruthy()
    expect(mock.mock.calls.some(([url]) => url.includes('/rooms/available?'))).toBe(true)
  })
  it('loads real-contract fields and rooms without requesting non-existent policy GET APIs', async () => {
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
    expect(screen.getByText(/정책 조회를 제공하지 않아/)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
    await screen.findByText('테헤란로 1')
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
    expect(mock.mock.calls.filter(([url]) => !url.includes('/rooms?'))).toHaveLength(1)
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
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(3))
    expect(mock.mock.calls[2][0]).toContain('page=1')
    await screen.findByRole('heading', { name: '스탠다드' })
    expect(mock.mock.calls.filter(([url]) => !url.includes('/rooms?'))).toHaveLength(1)
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
