import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AccommodationSearchPage } from './AccommodationSearchPage'
import { accommodationPage } from '../test/accommodation'

function renderPage() {
  return render(
    <MemoryRouter>
      <AccommodationSearchPage />
    </MemoryRouter>,
  )
}
function submit() {
  fireEvent.submit(screen.getByRole('form', { name: '숙소 검색 조건' }))
}

describe('AccommodationSearchPage with the real API client', () => {
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
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json(accommodationPage({ content: [], totalElements: 0, totalPages: 0 })),
        ),
    )
    renderPage()
    await screen.findByText('검색 조건에 맞는 숙소가 없습니다.')
    expect((screen.getByRole('button', { name: '다음' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('0 / 0 페이지')).toBeTruthy()
  })
  it('offers retry after a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByRole('link', { name: '서울 호텔' })
  })
  it('validates date pairs, date ordering and price range before requesting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()
    await screen.findByRole('link', { name: '서울 호텔' })
    fireEvent.change(screen.getByLabelText('체크인'), { target: { value: '2030-01-02' } })
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
