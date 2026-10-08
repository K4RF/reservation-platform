import { fireEvent, render, screen } from '@testing-library/react'
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
  it('submits destination, stay dates and guests from the public home search', async () => {
    const mock = vi.fn().mockResolvedValue(Response.json(accommodationPage()))
    vi.stubGlobal('fetch', mock)
    renderAt('/')
    fireEvent.change(screen.getByLabelText('어디로 떠나세요?'), { target: { value: '서울특별시' } })
    fireEvent.change(screen.getByLabelText('체크인'), { target: { value: '2030-01-10' } })
    fireEvent.change(screen.getByLabelText('체크아웃'), { target: { value: '2030-01-12' } })
    fireEvent.change(screen.getByLabelText('인원'), { target: { value: '2' } })
    fireEvent.submit(screen.getByRole('form', { name: '여행 검색' }))
    await screen.findByRole('link', { name: '서울 호텔' })
    const query = new URL(mock.mock.calls[0][0], 'http://localhost').searchParams
    expect(query.get('city')).toBe('서울특별시')
    expect(query.get('checkInDate')).toBe('2030-01-10')
    expect(query.get('checkOutDate')).toBe('2030-01-12')
    expect(query.get('guestCount')).toBe('2')
    expect(new Headers(mock.mock.calls[0][1].headers).has('Authorization')).toBe(false)
  })
  it('rejects incomplete dates in home search before making any request', () => {
    const mock = vi.fn()
    vi.stubGlobal('fetch', mock)
    renderAt('/')
    fireEvent.change(screen.getByLabelText('체크인'), { target: { value: '2030-01-10' } })
    fireEvent.submit(screen.getByRole('form', { name: '여행 검색' }))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(mock).not.toHaveBeenCalled()
  })
  it('renders the home page inside the shared layout', () => {
    renderAt('/')

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: '주요 탐색' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: '주요 탐색' }).className).toBe('site-nav')
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Reservation Platform' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBe('page')
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

    expect(await screen.findByRole('heading', { name: 'Reservation Platform' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다.' })).toBeNull()
  })

  it('uses the shared header navigation to return home', async () => {
    renderAt('/missing')

    fireEvent.click(screen.getByRole('link', { name: '홈' }))

    expect(await screen.findByRole('heading', { name: 'Reservation Platform' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBe('page')
  })

  it('opens the login route from the shared header', async () => {
    renderAt('/')

    fireEvent.click(screen.getByRole('link', { name: '로그인' }))

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeTruthy()
  })
})
