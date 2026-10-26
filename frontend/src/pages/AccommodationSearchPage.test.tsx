import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

describe('AccommodationSearchPage with the real API client', () => {
  it('starts wide-screen filters expanded but keeps the native disclosure choice during draft editing', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage()
    await screen.findByRole('link', { name: '서울 호텔' })
    const summary = screen.getByText('상세 검색 필터')
    const details = summary.closest('details')!
    expect(details.open).toBe(true)
    fireEvent.click(summary)
    await waitFor(() => expect(details.open).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: '인원 1명 늘리기' }))
    expect(details.open).toBe(false)
    expect(mock).toHaveBeenCalledTimes(1)
    fireEvent.click(summary)
    expect(details.open).toBe(true)
  })
  it('keeps submitted summary separate from drafts and submits every relocated AND filter and sort once', async () => {
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage(
      '/?city=서울특별시&region=강남구&checkInDate=2030-01-10&checkOutDate=2030-01-12&guestCount=2&page=2&size=10',
    )
    await screen.findByRole('link', { name: '서울 호텔' })
    const summary = screen.getByLabelText('적용된 검색 조건')
    expect(summary.textContent).toContain('서울특별시 · 강남구')
    expect(summary.textContent).toContain('2030-01-10 → 2030-01-12')
    expect(summary.textContent).toContain('2명')
    expect(summary.textContent).toContain('등록순 · 오름차순')
    fireEvent.change(screen.getByLabelText('도시 (정확한 이름)'), {
      target: { value: '부산광역시' },
    })
    fireEvent.change(screen.getByLabelText('숙소명'), { target: { value: '호텔' } })
    fireEvent.change(screen.getByLabelText('최소 기본 1박 가격'), { target: { value: '100.25' } })
    fireEvent.change(screen.getByLabelText('최대 기본 1박 가격'), { target: { value: '200.75' } })
    fireEvent.click(screen.getByLabelText('주차'))
    fireEvent.click(screen.getByLabelText('수영장'))
    fireEvent.click(screen.getByLabelText('와이파이'))
    fireEvent.click(screen.getByLabelText('에어컨'))
    fireEvent.change(screen.getByLabelText('정렬'), { target: { value: 'NAME' } })
    fireEvent.change(screen.getByLabelText('정렬 방향'), { target: { value: 'DESC' } })
    const disclosure = screen.getByText('상세 검색 필터').closest('details')!
    fireEvent.click(screen.getByText('상세 검색 필터'))
    expect(disclosure.open).toBe(false)
    expect(summary.textContent).not.toContain('부산광역시')
    expect(summary.textContent).toContain('등록순 · 오름차순')
    expect(mock).toHaveBeenCalledTimes(1)
    // Closed details still belong to the same native form; no duplicated/hidden inputs.
    expect(document.querySelectorAll('#search-sort')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '정렬 적용' }))
    await waitFor(() => expect(mock).toHaveBeenCalledTimes(2))
    const query = new URL(mock.mock.calls[1][0], 'http://localhost').searchParams
    expect(query.get('page')).toBe('0')
    expect(query.get('size')).toBe('10')
    expect(query.get('city')).toBe('부산광역시')
    expect(query.get('region')).toBe('강남구')
    expect(query.get('name')).toBe('호텔')
    expect(query.get('minPrice')).toBe('100.25')
    expect(query.get('maxPrice')).toBe('200.75')
    expect(query.getAll('accommodationAmenities')).toEqual(['PARKING', 'POOL'])
    expect(query.getAll('roomAmenities')).toEqual(['WIFI', 'AIR_CONDITIONER'])
    expect(query.get('sortBy')).toBe('NAME')
    expect(query.get('direction')).toBe('DESC')
    await waitFor(() =>
      expect(screen.getByLabelText('적용된 검색 조건').textContent).toContain('이름순 · 내림차순'),
    )
  })
  it('restores URL guests, steps without querying, and submits the existing numeric guestCount contract', async () => {
    const mock = vi.fn().mockImplementation(() => Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderPage('/?guestCount=2&checkInDate=2030-01-10&checkOutDate=2030-01-12')
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(screen.getByLabelText('인원', { exact: true })).toHaveProperty('value', '2')
    fireEvent.click(screen.getByRole('button', { name: '인원 1명 줄이기' }))
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
    expect(screen.getByLabelText('인원', { exact: true })).toHaveProperty('value', '')
    expect(new URL(mock.mock.calls[0][0], 'http://localhost').searchParams.has('guestCount')).toBe(
      false,
    )
    fireEvent.change(screen.getByLabelText('인원', { exact: true }), { target: { value: '1.5' } })
    submit()
    expect(screen.getByRole('alert').textContent).toContain('양의 정수')
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
    submit()
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
    fireEvent.change(screen.getByLabelText('도시 (정확한 이름)'), {
      target: { value: '부산광역시' },
    })
    fireEvent.click(screen.getByRole('button', { name: '인원 1명 늘리기' }))
    expect(screen.getByText('숙소를 불러오고 있습니다.')).toBeTruthy()
    complete(Response.json(accommodationPage({ content: [], totalElements: 0, totalPages: 0 })))
    await screen.findByText('검색 조건에 맞는 숙소가 없습니다.')
    expect(screen.getByLabelText('도시 (정확한 이름)')).toHaveProperty('value', '부산광역시')
    expect(screen.getByLabelText('인원', { exact: true })).toHaveProperty('value', '3')
    expect(screen.getByLabelText('적용된 검색 조건').textContent).toContain('서울특별시')
    expect(screen.getByLabelText('적용된 검색 조건').textContent).toContain('2명')
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
    fireEvent.change(screen.getByLabelText('도시 (정확한 이름)'), {
      target: { value: '부산광역시' },
    })
    fireEvent.click(screen.getByRole('button', { name: '인원 1명 늘리기' }))
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new URL(fetchMock.mock.calls[1][0], 'http://localhost').searchParams.get('city')).toBe(
      '서울특별시',
    )
    expect(screen.getByLabelText('도시 (정확한 이름)')).toHaveProperty('value', '부산광역시')
    expect(screen.getByLabelText('인원', { exact: true })).toHaveProperty('value', '3')
    expect(screen.getByLabelText('적용된 검색 조건').textContent).toContain('서울특별시')
  })
  it('validates date pairs, date ordering and price range before requesting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    await screen.findByRole('link', { name: '서울 호텔' })
    fireEvent.change(screen.getByLabelText('체크인'), { target: { value: '2030-01-02' } })
    expect(screen.getByLabelText('체크아웃')).toHaveProperty('value', '2030-01-03')
    fireEvent.change(screen.getByLabelText('체크아웃'), { target: { value: '' } })
    submit()
    expect(screen.getByRole('alert').textContent).toContain('함께 입력')
    fireEvent.change(screen.getByLabelText('체크아웃'), { target: { value: '2030-01-01' } })
    submit()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('체크아웃'), { target: { value: '2030-01-03' } })
    fireEvent.change(screen.getByLabelText('최소 기본 1박 가격'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('최대 기본 1박 가격'), { target: { value: '100' } })
    submit()
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
