import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'
import { setAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'
import { accommodationPage } from '../test/accommodation'
import { safeLoginReturn } from './loginReturn'

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}
describe('accommodation routes', () => {
  it('requires authentication before querying', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderAt('/accommodations')
    expect(await screen.findByRole('heading', { name: '로그인' })).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('lets a member search and follow a card to the explicit detail handoff', async () => {
    setAccessToken(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(accommodationPage())))
    renderAt('/accommodations')
    fireEvent.click(await screen.findByRole('link', { name: '서울 호텔' }))
    expect(await screen.findByRole('heading', { name: '숙소 상세 화면 준비 중' })).toBeTruthy()
  })
  it('allows only the internal accommodation return target', () => {
    expect(safeLoginReturn('/accommodations/7?from=search')).toBe('/accommodations/7?from=search')
    expect(safeLoginReturn('//evil.example/accommodations')).toBe('/')
    expect(safeLoginReturn('/accommodations-evil')).toBe('/')
  })
})
