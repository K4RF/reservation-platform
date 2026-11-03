import * as searchLayers from '../test/searchLayers'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccommodationSearchPage } from './AccommodationSearchPage'
import { accommodationPage } from '../test/accommodation'

function renderPage(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AccommodationSearchPage />
    </MemoryRouter>,
  )
}
function submit() {
  fireEvent.submit(screen.getByRole('form', { name: '숙소 검색 조건' }))
}
function submitFilters() {
  fireEvent.submit(screen.getByRole('form', { name: '상세 검색 조건' }))
}

describe('AccommodationSearchPage with the real API client', () => {
  it('retains a Sheet draft during wide resize without duplicate controls and restores sidebar focus on cancel', async () => {
    let narrow = true
    let notify = () => {}
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width') ? narrow : !narrow,
        addEventListener: (_: string, listener: () => void) => {
          if (query.includes('max-width')) notify = listener
        },
        removeEventListener: vi.fn(),
      })),
    )
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage()
    await screen.findByRole('link', { name: '서울 호텔' })
    fireEvent.click(screen.getByRole('button', { name: /^필터/ }))
    fireEvent.change(screen.getByLabelText('숙소명'), { target: { value: '미제출' } })
    act(() => {
      narrow = false
      notify()
    })
    expect(screen.getByRole('dialog', { name: '상세 검색 필터' })).toBeTruthy()
    expect(screen.getAllByLabelText('숙소명')).toHaveLength(1)
    expect(screen.getByLabelText('숙소명')).toHaveProperty('value', '미제출')
    fireEvent.keyDown(screen.getByLabelText('숙소명'), { key: 'Escape' })
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: '원하는 머무름' })),
    )
    expect(screen.getByLabelText('숙소명')).toHaveProperty('value', '')
    expect(document.body.style.overflow).toBe('')
    expect(mock).toHaveBeenCalledOnce()
  })
  it('uses a desktop sidebar and keeps sort, filter and compact drafts independent', async () => {
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage(
      '/?city=서울특별시&name=기존&page=2&size=10&checkInDate=2030-01-10&checkOutDate=2030-01-12',
    )
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(screen.getByRole('complementary', { name: '상세 검색 필터' })).toBeTruthy()
    expect(document.querySelector('.search-filters')?.tagName).toBe('ASIDE')
    const summary = screen.getByLabelText('적용된 검색 조건')
    fireEvent.change(screen.getByLabelText('여행지 · 도시명'), { target: { value: '부산광역시' } })
    fireEvent.change(screen.getByLabelText('숙소명'), { target: { value: '미제출' } })
    expect(summary.textContent).toContain('서울특별시')
    expect(mock).toHaveBeenCalledOnce()
    fireEvent.change(screen.getByLabelText('숙소 정렬'), { target: { value: 'NAME:DESC' } })
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2))
    const sorted = new URL(mock.mock.calls[1][0], 'http://localhost').searchParams
    expect(sorted.get('city')).toBe('서울특별시')
    expect(sorted.get('name')).toBe('기존')
    expect(sorted.get('sortBy')).toBe('NAME')
    expect(sorted.get('direction')).toBe('DESC')
    expect(sorted.get('page')).toBe('0')
    fireEvent.change(screen.getByLabelText('숙소명'), { target: { value: '호텔' } })
    fireEvent.change(screen.getByLabelText('지역'), { target: { value: '강남구' } })
    fireEvent.change(screen.getByLabelText('최소 기본 1박 가격'), { target: { value: '100.25' } })
    fireEvent.change(screen.getByLabelText('최대 기본 1박 가격'), { target: { value: '200.75' } })
    for (const label of ['주차', '수영장', '와이파이', '에어컨'])
      fireEvent.click(screen.getByLabelText(label))
    submitFilters()
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(3))
    const query = new URL(mock.mock.calls[2][0], 'http://localhost').searchParams
    expect(query.get('size')).toBe('10')
    expect(query.get('name')).toBe('호텔')
    expect(query.get('region')).toBe('강남구')
    expect(query.get('minPrice')).toBe('100.25')
    expect(query.get('maxPrice')).toBe('200.75')
    expect(query.getAll('accommodationAmenities')).toEqual(['PARKING', 'POOL'])
    expect(query.getAll('roomAmenities')).toEqual(['WIFI', 'AIR_CONDITIONER'])
    expect(query.get('sortBy')).toBe('NAME')
    expect(query.get('direction')).toBe('DESC')
  })
  it('cancels Mobile Sheet previews/reset without a GET and restores focus and scroll lock', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage('/?name=호텔&roomAmenities=WIFI')
    await screen.findByRole('link', { name: '서울 호텔' })
    const trigger = screen.getByRole('button', { name: /^필터/ })
    expect(screen.queryByLabelText('숙소명')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '상세 검색 필터' })).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.change(screen.getByLabelText('숙소명'), { target: { value: '미제출' } })
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    expect(screen.getByLabelText('숙소명')).toHaveProperty('value', '')
    expect(screen.getByLabelText('와이파이')).toHaveProperty('checked', false)
    expect(mock).toHaveBeenCalledOnce()
    fireEvent.keyDown(screen.getByLabelText('숙소명'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
    fireEvent.click(trigger)
    expect(screen.getByLabelText('숙소명')).toHaveProperty('value', '호텔')
    expect(screen.getByLabelText('와이파이')).toHaveProperty('checked', true)
    fireEvent.click(screen.getByRole('button', { name: '필터 취소' }))
    expect(mock).toHaveBeenCalledOnce()
  })
  it('validates Mobile filters then explicitly applies/reset them while retaining legacy URL settings', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('max-width'),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage('/?city=서울특별시&status=INACTIVE&size=10&page=2')
    await screen.findByRole('link', { name: '서울 호텔' })
    fireEvent.click(screen.getByRole('button', { name: /^필터/ }))
    fireEvent.change(screen.getByLabelText('최소 기본 1박 가격'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('최대 기본 1박 가격'), { target: { value: '100' } })
    submitFilters()
    expect(screen.getByRole('alert').textContent).toContain('최소 가격 이상')
    expect(document.activeElement).toBe(screen.getByRole('alert'))
    expect(mock).toHaveBeenCalledOnce()
    fireEvent.change(screen.getByLabelText('최대 기본 1박 가격'), { target: { value: '200.75' } })
    fireEvent.click(screen.getByLabelText('주차'))
    fireEvent.click(screen.getByLabelText('수영장'))
    submitFilters()
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2))
    const query = new URL(mock.mock.calls[1][0], 'http://localhost').searchParams
    expect(query.getAll('accommodationAmenities')).toEqual(['PARKING', 'POOL'])
    expect(query.get('status')).toBe('INACTIVE')
    expect(query.get('size')).toBe('10')
    expect(query.get('page')).toBe('0')
    expect(query.get('city')).toBe('서울특별시')
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: '숙소 검색' })),
    )
    fireEvent.click(screen.getByRole('button', { name: /^필터/ }))
    fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
    expect(mock).toHaveBeenCalledTimes(2)
    submitFilters()
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(3))
    const reset = new URL(mock.mock.calls[2][0], 'http://localhost').searchParams
    expect(reset.has('minPrice')).toBe(false)
    expect(reset.getAll('accommodationAmenities')).toEqual([])
    expect(reset.get('size')).toBe('10')
    expect(reset.get('status')).toBe('INACTIVE')
  })
  it('restores URL guests, steps without querying, and submits the existing numeric guestCount contract', async () => {
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage('/?guestCount=2&checkInDate=2030-01-10&checkOutDate=2030-01-12')
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(searchLayers.committedGuestInput('인원')).toHaveProperty('value', '2')
    searchLayers.stepGuests('인원', false)
    expect(mock).toHaveBeenCalledTimes(1)
    submit()
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2))
    const query = new URL(mock.mock.calls[1][0], 'http://localhost').searchParams
    expect(query.get('guestCount')).toBe('1')
    expect(query.get('checkInDate')).toBe('2030-01-10')
    expect(query.get('checkOutDate')).toBe('2030-01-12')
    expect(query.get('page')).toBe('0')
  })
  it('preserves omitted optional guests and rejects invalid direct input before another GET', async () => {
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage()
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(searchLayers.committedGuestInput('인원')).toHaveProperty('value', '')
    expect(new URL(mock.mock.calls[0][0], 'http://localhost').searchParams.has('guestCount')).toBe(
      false,
    )
    searchLayers.setGuests('1.5', '인원')
    expect(screen.getByRole('spinbutton', { name: '인원' })).toHaveProperty('value', '1.5')
    expect(screen.getByRole('button', { name: '인원 적용' })).toHaveProperty('disabled', true)
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('shows loading, lists results, pages with preserved filters and resets a new search to page zero', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Response.json(accommodationPage({ totalPages: 2, totalElements: 21, last: false })),
      )
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    expect(screen.getByText('숙소를 불러오고 있습니다.')).toBeTruthy()
    await screen.findByRole('link', { name: '서울 호텔' })
    expect((screen.getByRole('button', { name: '이전' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('숙소명'), { target: { value: '호텔' } })
    submitFilters()
    await screen.findByRole('link', { name: '서울 호텔' })
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const query = new URL(fetchMock.mock.calls[2][0], 'http://localhost').searchParams
    expect(query.get('name')).toBe('호텔')
    expect(query.get('page')).toBe('1')
    await screen.findByRole('link', { name: '서울 호텔' })
    submit()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    expect(new URL(fetchMock.mock.calls[3][0], 'http://localhost').searchParams.get('page')).toBe(
      '0',
    )
  })
  it('shows empty results and disables both pagination buttons', async () => {
    let complete!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve
          }),
      ),
    )
    renderPage('/?city=서울특별시&guestCount=2')
    fireEvent.change(screen.getByLabelText('여행지 · 도시명'), {
      target: { value: '부산광역시' },
    })
    searchLayers.stepGuests('인원', true)
    expect(screen.getByText('숙소를 불러오고 있습니다.')).toBeTruthy()
    complete(Response.json(accommodationPage({ content: [], totalElements: 0, totalPages: 0 })))
    await screen.findByText('검색 조건에 맞는 숙소가 없습니다.')
    expect(screen.getByLabelText('여행지 · 도시명')).toHaveProperty('value', '부산광역시')
    expect(searchLayers.committedGuestInput('인원')).toHaveProperty('value', '3')
    expect(screen.getByLabelText('적용된 검색 조건').textContent).toContain('서울특별시')
    expect(screen.getByLabelText('적용된 검색 조건').textContent).toContain('2명')
    const notice = screen.getByText(/변경 사항은 검색 후 반영됩니다/)
    expect(notice.textContent).toContain('서울특별시')
    expect(notice.textContent).not.toContain('부산광역시')
    expect(notice.closest('.sr-only')).toBeNull()
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('0 / 0 페이지')).toBeTruthy()
  })
  it('offers retry after a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', fetchMock)
    renderPage('/?city=서울특별시&guestCount=2')
    await screen.findByRole('alert')
    fireEvent.change(screen.getByLabelText('여행지 · 도시명'), {
      target: { value: '부산광역시' },
    })
    searchLayers.stepGuests('인원', true)
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new URL(fetchMock.mock.calls[1][0], 'http://localhost').searchParams.get('city')).toBe(
      '서울특별시',
    )
    expect(screen.getByLabelText('여행지 · 도시명')).toHaveProperty('value', '부산광역시')
    expect(searchLayers.committedGuestInput('인원')).toHaveProperty('value', '3')
    expect(screen.getByLabelText('적용된 검색 조건').textContent).toContain('서울특별시')
  })
  it('validates date pairs, date ordering and price range before requesting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    await screen.findByRole('link', { name: '서울 호텔' })
    searchLayers.editStayDate('체크인', '2030-01-02')
    expect(searchLayers.committedDateInput('체크아웃')).toHaveProperty('value', '2030-01-03')
    searchLayers.editStayDate('체크아웃', '')
    expect(screen.getByRole('button', { name: '날짜 적용' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toContain('모두 입력')
    searchLayers.editStayDate('체크아웃', '2030-01-01')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    searchLayers.editStayDate('체크아웃', '2030-01-03')
    fireEvent.change(screen.getByLabelText('최소 기본 1박 가격'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('최대 기본 1박 가격'), { target: { value: '100' } })
    submitFilters()
    expect(screen.getByRole('alert').textContent).toContain('최소 가격 이상')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('ignores late responses from a replaced search', async () => {
    let resolveOld!: (response: Response) => void
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveOld = resolve
          }),
      )
      .mockResolvedValueOnce(
        Response.json(accommodationPage({ content: [], totalElements: 0, totalPages: 0 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    submit()
    await screen.findByText('검색 조건에 맞는 숙소가 없습니다.')
    resolveOld(Response.json(accommodationPage()))
    await waitFor(() => expect(screen.queryByRole('link', { name: '서울 호텔' })).toBeNull())
  })
})
