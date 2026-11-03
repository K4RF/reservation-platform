import * as searchLayers from '../test/searchLayers'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'
import { bookingCompletePath } from './routePaths'
import { accommodation, accommodationPage } from '../test/accommodation'
import { media } from '../test/media'
import { explorationDetailPath } from './bookingContext'
import { committedDates, directDates, setGuests, setStayDates } from '../test/searchLayers'

describe('reservation route identity', () => {
  it('builds completion routes only from the server numeric ID', () => {
    expect(bookingCompletePath(42)).toBe('/reservations/42/complete')
  })
  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN])('rejects invalid ID %s', (id) => {
    expect(() => bookingCompletePath(id)).toThrow(RangeError)
  })
})

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('AppRoutes', () => {
  it('uses a decorative brand image and a bounded public catalog read without fabricated rankings', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json(accommodationPage())))
    vi.stubGlobal('fetch', fetch)
    const { container } = renderAt('/')
    const image = container.querySelector('.home-hero-image')!
    expect(image.getAttribute('alt')).toBe('')
    expect(image.getAttribute('width')).toBe('1600')
    expect(image.getAttribute('height')).toBe('900')
    expect(image.getAttribute('srcset')).toContain('800w')
    expect(image.getAttribute('srcset')).toContain('1600w')
    expect(image.getAttribute('fetchpriority')).toBe('high')
    expect(image.getAttribute('loading')).not.toBe('lazy')
    expect(image.getAttribute('src')).toContain('home-a1-1600.webp')
    expect(container.querySelector('.home-headline-lead')?.textContent).toBe('Somewhere')
    expect(screen.getByRole('heading', { name: 'Stay for the feeling.' })).toBeTruthy()
    expect(screen.getByText('AI 생성 브랜드 이미지 · 실제 숙소 사진이 아닙니다.')).toBeTruthy()
    const target = screen.getByLabelText('여행지 · 도시명')
    expect(screen.getByRole('link', { name: '여행 검색으로 이동 ↓' }).getAttribute('href')).toBe(
      '#' + target.id,
    )
    expect(screen.getByRole('link', { name: '전체 숙소 →' }).getAttribute('href')).toBe(
      '/accommodations',
    )
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe(
      '/api/v1/accommodations?status=ACTIVE&page=0&size=2&sortBy=ID&direction=ASC',
    )
    expect(new Headers(fetch.mock.calls[0][1].headers).has('Authorization')).toBe(false)
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(
      within(screen.getByRole('list', { name: '숙소 목록' })).getAllByRole('listitem'),
    ).toHaveLength(1)
  })

  it('renders bounded photo exploration using only real response fields and keeps drafts after Media failure', async () => {
    const photo = media()
    const fetch = vi.fn().mockResolvedValue(
      Response.json(
        accommodationPage({
          content: [
            { ...accommodation, representativeImage: photo, images: [photo] },
            {
              ...accommodation,
              accommodationId: 8,
              name: '주소만 있는 숙소',
              city: null,
              region: null,
              address: '기존 상세 주소',
            },
          ],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetch)
    renderAt('/')
    const card = await screen.findByRole('link', { name: '서울 호텔' })
    expect(card.getAttribute('href')).toBe(explorationDetailPath(7, ''))
    expect(within(card).getByText('서울특별시 · 강남구')).toBeTruthy()
    expect(within(card).queryByText(accommodation.description)).toBeNull()
    const image = within(card).getByRole('img', { name: photo.altText! })
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(image.getAttribute('src')).toBe('/api/v1/media/1/content')
    const legacy = screen.getByRole('link', { name: '주소만 있는 숙소' })
    expect(within(legacy).getByText('기존 상세 주소')).toBeTruthy()
    expect(within(legacy).getByText('숙소 사진 미제공')).toBeTruthy()
    expect(within(legacy).queryByRole('img')).toBeNull()
    fireEvent.change(screen.getByLabelText('여행지 · 도시명'), { target: { value: '부산광역시' } })
    fireEvent.error(image)
    expect(within(card).getByText('사진을 불러오지 못했습니다.')).toBeTruthy()
    expect(card.getAttribute('href')).toBe(explorationDetailPath(7, ''))
    expect(screen.getByLabelText('여행지 · 도시명')).toHaveProperty('value', '부산광역시')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('defensively shows at most two ACTIVE rows in response order without filling missing slots', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          accommodationPage({
            content: [
              { ...accommodation, accommodationId: 8, name: '비활성 숙소', status: 'INACTIVE' },
              accommodation,
              { ...accommodation, accommodationId: 9, name: '다음 숙소' },
              { ...accommodation, accommodationId: 10, name: '초과 숙소' },
            ],
          }),
        ),
      ),
    )
    renderAt('/')
    const list = await screen.findByRole('list', { name: '숙소 목록' })
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([expect.stringContaining('서울 호텔'), expect.stringContaining('다음 숙소')])
    expect(screen.queryByRole('link', { name: '비활성 숙소' })).toBeNull()
    expect(screen.queryByRole('link', { name: '초과 숙소' })).toBeNull()
  })

  it('keeps search usable through catalog loading, failure, explicit retry and empty results', async () => {
    let resolve!: (response: Response) => void
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          }),
      )
      .mockResolvedValueOnce(
        Response.json(accommodationPage({ content: [], totalElements: 0, totalPages: 0 })),
      )
    vi.stubGlobal('fetch', fetch)
    renderAt('/')
    expect(screen.getByText('머물 곳을 불러오고 있습니다.').getAttribute('role')).toBe('status')
    fireEvent.change(screen.getByLabelText('여행지 · 도시명'), { target: { value: '제주시' } })
    await act(async () => resolve(Response.json({}, { status: 500 })))
    expect(await screen.findByText('머물 곳을 불러오지 못했습니다.')).toBeTruthy()
    expect(fetch).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(
      await screen.findByText('아직 소개할 숙소가 없습니다. 전체 숙소에서 다시 살펴보세요.'),
    ).toBeTruthy()
    expect(screen.queryByRole('list', { name: '숙소 목록' })).toBeNull()
    expect(screen.getByLabelText('여행지 · 도시명')).toHaveProperty('value', '제주시')
    expect(screen.getByRole('button', { name: '숙소 찾기' })).toHaveProperty('disabled', false)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toBe(fetch.mock.calls[0][0])
  })

  it('aborts a pending Home read on search navigation and ignores its late response', async () => {
    let resolve!: (response: Response) => void
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          }),
      )
      .mockImplementation(() => Promise.resolve(Response.json(accommodationPage())))
    vi.stubGlobal('fetch', fetch)
    renderAt('/')
    fireEvent.submit(screen.getByRole('form', { name: '여행 검색' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () =>
      resolve(
        Response.json(
          accommodationPage({ content: [{ ...accommodation, name: '늦은 Home 결과' }] }),
        ),
      ),
    )
    expect(screen.queryByText('늦은 Home 결과')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Stay for the feeling.' })).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps search drafts after a brand image failure without repeating the catalog read', () => {
    const fetch = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json(accommodationPage())))
    vi.stubGlobal('fetch', fetch)
    const { container } = renderAt('/')
    fireEvent.change(screen.getByLabelText('여행지 · 도시명'), { target: { value: '서울특별시' } })
    setStayDates('2030-01-10', '2030-01-11')
    setGuests('2')
    fireEvent.error(container.querySelector('.home-hero-image')!)
    expect(container.querySelector('.home-hero-image')).toBeNull()
    expect(
      screen
        .getByText('브랜드 이미지를 불러오지 못했습니다. 검색은 계속 이용할 수 있습니다.')
        .getAttribute('role'),
    ).toBe('status')
    expect(screen.getByLabelText('여행지 · 도시명')).toHaveProperty('value', '서울특별시')
    expect(committedDates(screen.getByRole('form', { name: '여행 검색' }))).toEqual({
      checkInDate: '2030-01-10',
      checkOutDate: '2030-01-11',
    })
    expect(screen.getByRole('button', { name: '인원 선택' }).textContent).toContain('총 2명')
    expect(screen.getByRole('button', { name: '숙소 찾기' }).hasAttribute('disabled')).toBe(false)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('submits destination, stay dates and guests from the public home search', async () => {
    const mock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json(accommodationPage())))
    vi.stubGlobal('fetch', mock)
    renderAt('/')
    fireEvent.change(screen.getByLabelText('여행지 · 도시명'), { target: { value: '서울특별시' } })
    setStayDates('2030-01-10', '2030-01-12')
    setGuests('2')
    expect(mock).toHaveBeenCalledOnce() // Home discovery only; staged editing does not search.
    fireEvent.submit(screen.getByRole('form', { name: '여행 검색' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    const query = new URL(mock.mock.calls[1][0], 'http://localhost').searchParams
    expect(query.get('city')).toBe('서울특별시')
    expect(query.get('checkInDate')).toBe('2030-01-10')
    expect(query.get('checkOutDate')).toBe('2030-01-12')
    expect(query.get('guestCount')).toBe('2')
    expect(screen.getByRole('button', { name: '인원 선택' }).textContent).toContain('총 2명')
    expect(new Headers(mock.mock.calls[0][1].headers).has('Authorization')).toBe(false)
  })
  it('rejects incomplete dates without a search beyond the independent Home catalog read', () => {
    const mock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json(accommodationPage())))
    vi.stubGlobal('fetch', mock)
    renderAt('/')
    directDates()
    searchLayers.editStayDate('체크인', '2030-01-10')
    expect(searchLayers.committedDateInput('체크아웃')).toHaveProperty('value', '2030-01-11')
    searchLayers.editStayDate('체크아웃', '')
    expect(screen.getByRole('button', { name: '날짜 적용' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(mock).toHaveBeenCalledOnce()
  })
  it('renders the home page inside the shared layout', () => {
    renderAt('/')

    expect(screen.getByRole('banner')).toBeTruthy()
    const brand = within(screen.getByRole('banner')).getByRole('link', {
      name: 'Reservation Platform',
    })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.querySelector('.site-brand-mark')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('contentinfo').textContent).toContain('Reservation Platform')
    expect(screen.getByRole('contentinfo').textContent).toContain('나에게 맞는 숙소, 편안한 여정')
    expect(screen.getByRole('navigation', { name: '주요 탐색' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: '주요 탐색' }).className).toBe('site-nav')
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('link', { name: '본문으로 건너뛰기' }).getAttribute('href')).toBe(
      '#main-content',
    )
    expect(screen.getByRole('main').id).toBe('main-content')
    expect(screen.getByRole('main').tabIndex).toBe(-1)
    expect(screen.getByRole('heading', { name: 'Somewhere you can slow down.' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByRole('link', { name: '내 예약' })).toBeNull()
    expect(screen.queryByRole('link', { name: '관리자' })).toBeNull()
  })

  it('renders the not found page inside the shared layout for an unknown direct path', () => {
    renderAt('/missing/reports')

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다.' })).toBeTruthy()
    expect(
      screen
        .getByRole('region', { name: '페이지를 찾을 수 없습니다.' })
        .classList.contains('auth-page'),
    ).toBe(true)
    expect(screen.getByRole('complementary', { name: '공개 탐색 안내' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '홈으로 돌아가기' }).getAttribute('href')).toBe('/')
  })

  it('navigates from an unknown path back to home', async () => {
    renderAt('/missing')

    fireEvent.click(screen.getByRole('link', { name: '홈으로 돌아가기' }))

    expect(
      await screen.findByRole('heading', { name: 'Somewhere you can slow down.' }),
    ).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다.' })).toBeNull()
  })

  it('uses the shared header navigation to return home', async () => {
    renderAt('/missing')

    fireEvent.click(screen.getByRole('link', { name: '홈' }))

    expect(
      await screen.findByRole('heading', { name: 'Somewhere you can slow down.' }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the login route from the shared header', async () => {
    renderAt('/')

    fireEvent.click(screen.getByRole('link', { name: '로그인' }))

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeTruthy()
  })
})
