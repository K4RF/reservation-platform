import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccommodationSearchPage } from './AccommodationSearchPage'
import { accommodation, accommodationPage } from '../test/accommodation'
import { roomPage } from '../test/room'
import { AuthProvider } from '../state/AuthProvider'
import { AccommodationDetailPage } from './AccommodationDetailPage'
import { canonicalSearchQuery } from '../components/accommodation/searchQuery'

function HistoryControls() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="현재 검색 URL">{location.search}</output>
      <button onClick={() => navigate(-1)}>뒤로가기</button>
      <button onClick={() => navigate(1)}>앞으로가기</button>
    </>
  )
}
function renderAt(query: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/accommodations' + query]}>
        <HistoryControls />
        <Routes>
          <Route path="/accommodations" element={<AccommodationSearchPage />} />
          <Route path="/accommodations/:accommodationId" element={<AccommodationDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}
function mockApi() {
  const mock = vi.fn().mockImplementation((url: string) => {
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page') ?? 0)
    return Promise.resolve(
      Response.json(
        accommodationPage({
          page,
          totalPages: 3,
          totalElements: 45,
          first: page === 0,
          last: page === 2,
        }),
      ),
    )
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
const submit = () => fireEvent.submit(screen.getByRole('form', { name: '숙소 검색 조건' }))

describe('search URL and pagination navigation', () => {
  it.each(['return link', 'history back'])(
    'restores filters/page and only restores scroll/focus after the fresh search GET via %s',
    async (mode) => {
      const query =
        '?name=호텔&city=서울특별시&region=강남구&page=1&size=10&sortBy=NAME&direction=DESC&roomAmenities=WIFI&checkInDate=2030-07-20&checkOutDate=2030-07-22&guestCount=2'
      let searches = 0
      let resolveReturn!: (response: Response) => void
      const mock = vi.fn((url: string) => {
        const path = new URL(url, 'http://localhost').pathname
        if (path === '/api/v1/accommodations') {
          searches++
          if (searches === 2)
            return new Promise<Response>((resolve) => {
              resolveReturn = resolve
            })
          return Promise.resolve(
            Response.json(
              accommodationPage({
                page: 1,
                size: 10,
                totalPages: 3,
                totalElements: 25,
                first: false,
                last: false,
              }),
            ),
          )
        }
        return Promise.resolve(Response.json(path.includes('/rooms') ? roomPage() : accommodation))
      })
      vi.stubGlobal('fetch', mock)
      vi.stubGlobal('scrollY', 831)
      renderAt(query)
      fireEvent.click(await screen.findByRole('link', { name: '서울 호텔' }))
      await screen.findByRole('heading', { name: '서울 호텔' })
      const back = screen.getByRole('link', { name: '숙소 검색으로 돌아가기' })
      expect(back.getAttribute('href')).toBe('/accommodations?' + canonicalSearchQuery(query))
      vi.mocked(window.scrollTo).mockClear()
      if (mode === 'return link') fireEvent.click(back)
      else fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
      await screen.findByText('숙소를 불러오고 있습니다.')
      expect(window.scrollTo).not.toHaveBeenCalled()
      resolveReturn(
        Response.json(
          accommodationPage({
            page: 1,
            size: 10,
            totalPages: 3,
            totalElements: 25,
            first: false,
            last: false,
          }),
        ),
      )
      const trigger = await screen.findByRole('link', { name: '서울 호텔' })
      await waitFor(() => expect(document.activeElement).toBe(trigger))
      expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({
        left: 0,
        top: 831,
        behavior: 'instant',
      })
      expect(screen.getByText('2 / 3 페이지')).toBeTruthy()
      expect(screen.getByLabelText('숙소명')).toHaveProperty('value', '호텔')
      expect(screen.getByLabelText('도시 (정확한 이름)')).toHaveProperty('value', '서울특별시')
      expect(screen.getByLabelText('인원', { exact: true })).toHaveProperty('value', '2')
      expect(screen.getByLabelText('정렬')).toHaveProperty('value', 'NAME')
      expect(screen.getByLabelText('와이파이')).toHaveProperty('checked', true)
      expect(
        new URL(
          mock.mock.calls.filter(
            ([url]) => new URL(url, 'http://localhost').pathname === '/api/v1/accommodations',
          )[1][0],
          'http://localhost',
        ).searchParams.get('page'),
      ).toBe('1')
      if (mode === 'history back') {
        fireEvent.click(screen.getByRole('button', { name: '앞으로가기' }))
        await screen.findByRole('heading', { name: '서울 호텔' })
        expect(
          screen.getByRole('link', { name: '숙소 검색으로 돌아가기' }).getAttribute('href'),
        ).toBe('/accommodations?' + canonicalSearchQuery(query))
      }
    },
  )
  it('restores filters and page from a deep link and from a remount (reload after authentication)', async () => {
    const mock = mockApi()
    const view = renderAt(
      '?name=호텔&city=서울특별시&page=1&size=10&sortBy=NAME&direction=DESC&roomAmenities=WIFI',
    )
    await screen.findByRole('link', { name: '서울 호텔' })
    expect((screen.getByLabelText('숙소명') as HTMLInputElement).value).toBe('호텔')
    expect((screen.getByLabelText('페이지 크기') as HTMLInputElement).value).toBe('10')
    expect((screen.getByLabelText('와이파이') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('2 / 3 페이지')).toBeTruthy()
    const before = mock.mock.calls[0][0]
    view.unmount()
    renderAt(
      '?name=호텔&city=서울특별시&page=1&size=10&sortBy=NAME&direction=DESC&roomAmenities=WIFI',
    )
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(mock.mock.calls[1][0]).toBe(before)
  })
  it('preserves submitted filters on pagination and restores form/API on back and forward', async () => {
    const mock = mockApi()
    renderAt('?name=첫검색')
    await screen.findByRole('link', { name: '서울 호텔' })
    fireEvent.change(screen.getByLabelText('숙소명'), { target: { value: '두번째' } })
    fireEvent.change(screen.getByLabelText('페이지 크기'), { target: { value: '10' } })
    fireEvent.click(screen.getByLabelText('주차'))
    submit()
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(screen.getByLabelText('현재 검색 URL').textContent).toContain('page=0')
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await screen.findByText('2 / 3 페이지')
    const query = new URL(mock.mock.calls.at(-1)![0], 'http://localhost').searchParams
    expect(query.get('name')).toBe('두번째')
    expect(query.get('size')).toBe('10')
    expect(query.getAll('accommodationAmenities')).toEqual(['PARKING'])
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    await screen.findByText('1 / 3 페이지')
    fireEvent.click(screen.getByRole('button', { name: '뒤로가기' }))
    await waitFor(() =>
      expect((screen.getByLabelText('숙소명') as HTMLInputElement).value).toBe('첫검색'),
    )
    fireEvent.click(screen.getByRole('button', { name: '앞으로가기' }))
    await waitFor(() =>
      expect((screen.getByLabelText('숙소명') as HTMLInputElement).value).toBe('두번째'),
    )
    await screen.findByRole('link', { name: '서울 호텔' })
    expect((screen.getByLabelText('주차') as HTMLInputElement).checked).toBe(true)
  })
  it('resets page on size or filter changes and supports previous/last boundaries', async () => {
    mockApi()
    renderAt('?page=2&size=20')
    await screen.findByText('3 / 3 페이지')
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '이전' }))
    await screen.findByText('2 / 3 페이지')
    fireEvent.change(screen.getByLabelText('페이지 크기'), { target: { value: '50' } })
    submit()
    await screen.findByText('1 / 3 페이지')
    expect(screen.getByLabelText('현재 검색 URL').textContent).toContain('page=0&size=50')
  })
  it('does not request malformed URLs and recovers when valid conditions are submitted', async () => {
    const mock = mockApi()
    renderAt('?page=-2&sortBy=PRICE')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(mock).not.toHaveBeenCalled()
    submit()
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(mock).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('현재 검색 URL').textContent).not.toContain('PRICE')
  })
})
