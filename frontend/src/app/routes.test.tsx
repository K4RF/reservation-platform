import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'
import { bookingCompletePath } from './routePaths'
import { accommodationPage } from '../test/accommodation'

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
  it('uses a decorative responsive brand image, explicit AI provenance and ordinary catalog entry without requests', () => {
    const fetch = vi.fn()
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
    expect(screen.getByText('AI 생성 브랜드 이미지 · 실제 숙소 사진이 아닙니다.')).toBeTruthy()
    const target = screen.getByRole('heading', { name: '어디로 떠나고 싶으세요?' })
    expect(target.tabIndex).toBe(-1)
    expect(screen.getByRole('link', { name: '여행 검색으로 이동 ↓' }).getAttribute('href')).toBe(
      '#' + target.id,
    )
    expect(screen.getByRole('link', { name: '전체 숙소 둘러보기 →' }).getAttribute('href')).toBe(
      '/accommodations',
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps search drafts and controls usable after a brand image failure without retrying or fetching catalog data', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { container } = renderAt('/')
    fireEvent.change(screen.getByLabelText('어디로 떠나세요?'), { target: { value: '서울특별시' } })
    fireEvent.change(screen.getByLabelText('체크인'), { target: { value: '2030-01-10' } })
    fireEvent.click(screen.getByRole('button', { name: '인원 1명 늘리기' }))
    fireEvent.error(container.querySelector('.home-hero-image')!)
    expect(container.querySelector('.home-hero-image')).toBeNull()
    expect(
      screen
        .getByText('브랜드 이미지를 불러오지 못했습니다. 검색은 계속 이용할 수 있습니다.')
        .getAttribute('role'),
    ).toBe('status')
    expect(screen.getByLabelText('어디로 떠나세요?')).toHaveProperty('value', '서울특별시')
    expect(screen.getByLabelText('체크인')).toHaveProperty('value', '2030-01-10')
    expect(screen.getByLabelText('체크아웃')).toHaveProperty('value', '2030-01-11')
    expect(screen.getByLabelText('인원', { exact: true })).toHaveProperty('value', '2')
    expect(screen.getByRole('button', { name: '숙소 찾기' }).hasAttribute('disabled')).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('submits destination, stay dates and guests from the public home search', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderAt('/')
    fireEvent.change(screen.getByLabelText('어디로 떠나세요?'), { target: { value: '서울특별시' } })
    fireEvent.change(screen.getByLabelText('체크인'), { target: { value: '2030-01-10' } })
    fireEvent.change(screen.getByLabelText('체크아웃'), { target: { value: '2030-01-12' } })
    fireEvent.click(screen.getByRole('button', { name: '인원 1명 늘리기' }))
    expect(mock).not.toHaveBeenCalled()
    fireEvent.submit(screen.getByRole('form', { name: '여행 검색' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    const query = new URL(mock.mock.calls[0][0], 'http://localhost').searchParams
    expect(query.get('city')).toBe('서울특별시')
    expect(query.get('checkInDate')).toBe('2030-01-10')
    expect(query.get('checkOutDate')).toBe('2030-01-12')
    expect(query.get('guestCount')).toBe('2')
    expect(screen.getByLabelText('인원', { exact: true })).toHaveProperty('value', '2')
    expect(new Headers(mock.mock.calls[0][1].headers).has('Authorization')).toBe(false)
  })
  it('rejects incomplete dates in home search before making any request', () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    renderAt('/')
    fireEvent.change(screen.getByLabelText('체크인'), { target: { value: '2030-01-10' } })
    expect(screen.getByLabelText('체크아웃')).toHaveProperty('value', '2030-01-11')
    fireEvent.change(screen.getByLabelText('체크아웃'), { target: { value: '' } })
    fireEvent.submit(screen.getByRole('form', { name: '여행 검색' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(mock).not.toHaveBeenCalled()
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
