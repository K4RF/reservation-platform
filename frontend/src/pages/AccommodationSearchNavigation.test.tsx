import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccommodationSearchPage } from './AccommodationSearchPage'
import { accommodationPage } from '../test/accommodation'

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
    <MemoryRouter initialEntries={['/accommodations' + query]}>
      <HistoryControls />
      <AccommodationSearchPage />
    </MemoryRouter>,
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
