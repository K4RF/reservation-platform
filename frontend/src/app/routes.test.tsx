import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'

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
  it('renders the home page inside the shared layout', () => {
    renderAt('/')

    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: '주요 탐색' })).toBeTruthy()
    expect(screen.getByRole('main')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Reservation Platform' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBe('page')
  })

  it('renders the not found page inside the shared layout for an unknown direct path', () => {
    renderAt('/admin/reports')

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
