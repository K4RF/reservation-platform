import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'
import { setAccessToken } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'
import { accommodationPage } from '../test/accommodation'
import { roomPage } from '../test/room'
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
  it.each(['/accommodations', '/accommodations/7'])(
    'allows anonymous exploration at %s without redirecting to login',
    async (path) => {
      const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
        (url: string) =>
          Promise.resolve(
            Response.json(
              url.includes('/rooms?')
                ? roomPage()
                : /\/accommodations\/7$/.test(url)
                  ? accommodationPage().content[0]
                  : accommodationPage(),
            ),
          ),
      )
      vi.stubGlobal('fetch', fetchMock)
      renderAt(path)
      expect(
        await screen.findByRole('heading', {
          name: path.endsWith('/7') ? '서울 호텔' : '숙소 검색',
          level: 1,
        }),
      ).toBeTruthy()
      expect(screen.queryByRole('heading', { name: '로그인' })).toBeNull()
      expect(fetchMock).toHaveBeenCalled()
      expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBeNull()
    },
  )
  it('lets a member search and follow a card to accommodation and room details', async () => {
    setAccessToken(accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 60))
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            Response.json(
              url.includes('/rooms?')
                ? roomPage()
                : /\/accommodations\/7$/.test(url)
                  ? accommodationPage().content[0]
                  : accommodationPage(),
            ),
          ),
        ),
    )
    renderAt('/accommodations')
    fireEvent.click(await screen.findByRole('link', { name: '서울 호텔' }))
    expect(await screen.findByRole('heading', { name: '서울 호텔', level: 1 })).toBeTruthy()
    expect(await screen.findByRole('heading', { name: '스탠다드' })).toBeTruthy()
  })
  it('allows only the internal accommodation return target', () => {
    expect(safeLoginReturn('/accommodations/7?from=search')).toBe('/accommodations/7?from=search')
    expect(safeLoginReturn('//evil.example/accommodations')).toBe('/')
    expect(safeLoginReturn('/accommodations-evil')).toBe('/')
  })
})
