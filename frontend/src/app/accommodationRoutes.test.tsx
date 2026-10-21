import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './routes'
import { AuthProvider } from '../state/AuthProvider'
import { accommodationPage } from '../test/accommodation'
import { roomPage } from '../test/room'

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
})
