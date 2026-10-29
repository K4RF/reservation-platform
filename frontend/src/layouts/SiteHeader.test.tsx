import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AuthContext } from '../state/authContext'
import type { AuthState } from '../state/authState'
import { mockDialog } from '../test/dialog'
import { RootLayout } from './RootLayout'

mockDialog()

const anonymous: AuthState = { status: 'anonymous', user: null, expiresAt: null }
function Page() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <section>
      <h1>테스트 페이지</h1>
      <output aria-label="현재 주소">{location.pathname + location.search + location.hash}</output>
      <input aria-label="작성 중인 내용" defaultValue="유지할 내용" />
      <button onClick={() => navigate(-1)}>뒤로 가기</button>
    </section>
  )
}
function renderFrame(
  path = '/',
  state: AuthState = anonymous,
  logout = vi.fn(async () => 'success' as const),
) {
  render(
    <AuthContext.Provider value={{ state, logout, signIn: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="*" element={<Page />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return logout
}
function openMenu() {
  const trigger = screen.getByRole('button', { name: '메뉴' })
  trigger.focus()
  fireEvent.click(trigger)
  return { trigger, dialog: screen.getByRole('dialog', { name: '여정의 시작' }) }
}

describe('consumer site frame', () => {
  it.each([
    ['/', 'home'],
    ['/accommodations', 'search'],
    ['/accommodations/7', 'detail'],
    ['/login', 'reading'],
    ['/reservations/42/complete', 'booking'],
    ['/admin/rooms', 'admin'],
  ])('uses the %s page frame without changing the child route', (path, frame) => {
    renderFrame(path)
    expect(screen.getByRole('main').getAttribute('data-page-frame')).toBe(frame)
    expect(screen.getByLabelText('현재 주소').textContent).toBe(path)
    expect(document.querySelector('.app-shell-home') !== null).toBe(frame === 'home')
  })

  it('closes on Escape, restores focus/scroll styles and preserves URL and draft', () => {
    const path = '/accommodations/7?checkInDate=2030-01-01&guestCount=2#rooms'
    renderFrame(path)
    const input = screen.getByRole('textbox', { name: '작성 중인 내용' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '수정한 내용' } })
    const { trigger, dialog } = openMenu()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '메뉴 닫기' }))
    expect(document.body.style.overflow).toBe('hidden')
    expect(
      within(dialog).getByRole('link', { name: '숙소 검색' }).getAttribute('aria-current'),
    ).toBe('page')
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overflow).toBe('')
    expect(input.value).toBe('수정한 내용')
    expect(screen.getByLabelText('현재 주소').textContent).toBe(path)
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('cycles keyboard focus and dismisses on explicit close or navigation without adding a menu history entry', () => {
    renderFrame('/login')
    const { dialog } = openMenu()
    const close = within(dialog).getByRole('button', { name: '메뉴 닫기' })
    const last = within(dialog).getByRole('link', { name: '회원가입' })
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.click(close)
    expect(screen.queryByRole('dialog')).toBeNull()
    const second = openMenu()
    fireEvent.click(within(second.dialog).getByRole('link', { name: '숙소 검색' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByLabelText('현재 주소').textContent).toBe('/accommodations')
    fireEvent.click(screen.getByRole('button', { name: '뒤로 가기' }))
    expect(screen.getByLabelText('현재 주소').textContent).toBe('/login')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['USER', 'ADMIN', null] as const)(
    'preserves the %s role destinations and logout action in the menu',
    (role) => {
      const logout = renderFrame('/', {
        status: 'authenticated',
        user: null,
        expiresAt: 9999999999999,
        role,
      })
      const { dialog } = openMenu()
      expect(Boolean(within(dialog).queryByRole('link', { name: '내 예약' }))).toBe(role !== null)
      expect(Boolean(within(dialog).queryByRole('link', { name: '관리자' }))).toBe(role === 'ADMIN')
      expect(within(dialog).queryByRole('link', { name: '로그인' })).toBeNull()
      fireEvent.click(within(dialog).getByRole('button', { name: '로그아웃' }))
      expect(logout).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )

  it('keeps loading and anonymous menus honest without authenticated destinations', () => {
    renderFrame('/', { status: 'loading', user: null, expiresAt: null })
    const { dialog } = openMenu()
    expect(within(dialog).getByRole('status').textContent).toBe('인증 확인 중…')
    expect(within(dialog).queryByRole('link', { name: '로그인' })).toBeNull()
    expect(within(dialog).queryByRole('link', { name: '내 예약' })).toBeNull()
  })

  it('does not cover the expired-session notice with a Home overlay', () => {
    renderFrame('/', { status: 'reauth_required', user: null, expiresAt: null })
    expect(document.querySelector('.app-shell-home')).toBeNull()
    expect(screen.getByText(/로그인이 만료되었습니다/).getAttribute('role')).toBe('status')
  })

  it('dismisses an open menu on a breakpoint change and releases its listener', () => {
    const media = new EventTarget()
    Object.assign(media, { matches: true })
    const remove = vi.spyOn(media, 'removeEventListener')
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    )
    renderFrame()
    openMenu()
    act(() => {
      media.dispatchEvent(new Event('change'))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Reservation Platform' }))
    fireEvent.click(screen.getByRole('link', { name: '로그인' }))
    expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
