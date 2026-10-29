import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { routePaths } from '../app/routePaths'
import { useAuth } from '../state/useAuth'

function NavigationLinks({
  loggingOut,
  onLogout,
  onNavigate,
}: {
  loggingOut: boolean
  onLogout: () => void
  onNavigate?: () => void
}) {
  const { state } = useAuth()
  return (
    <>
      <NavLink className="nav-link" end to={routePaths.home} onClick={onNavigate}>
        홈
      </NavLink>
      <NavLink className="nav-link" to={routePaths.accommodations} onClick={onNavigate}>
        숙소 검색
      </NavLink>
      {state.status === 'authenticated' && (state.role === 'USER' || state.role === 'ADMIN') && (
        <NavLink className="nav-link" to={routePaths.reservations} onClick={onNavigate}>
          내 예약
        </NavLink>
      )}
      {state.status === 'authenticated' && state.role === 'ADMIN' && (
        <NavLink className="nav-link" to={routePaths.admin} onClick={onNavigate}>
          관리자
        </NavLink>
      )}
      {state.status === 'authenticated' ? (
        <button
          className="nav-link nav-action"
          type="button"
          disabled={loggingOut}
          aria-busy={loggingOut}
          onClick={() => {
            onNavigate?.()
            onLogout()
          }}
        >
          {loggingOut ? '로그아웃 중…' : '로그아웃'}
        </button>
      ) : state.status !== 'loading' ? (
        <>
          <NavLink className="nav-link" to={routePaths.login} onClick={onNavigate}>
            로그인
          </NavLink>
          <NavLink className="nav-link" to={routePaths.signup} onClick={onNavigate}>
            회원가입
          </NavLink>
        </>
      ) : null}
      {state.status === 'loading' && <span role="status">인증 확인 중…</span>}
    </>
  )
}

function SiteMenu({
  onDismiss,
  loggingOut,
  onLogout,
}: {
  onDismiss: () => void
  loggingOut: boolean
  onLogout: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    const previousFocus = document.activeElement
    const brand = element.closest('header')?.querySelector<HTMLElement>('.site-brand')
    // Modal-only scroll lock, never a workaround for page overflow.
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    element.showModal()
    closeButton.current?.focus({ preventScroll: true })
    return () => {
      if (element.open) element.close()
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        // A desktop resize hides the mobile trigger: return to a visible landmark instead.
        const target = window.matchMedia?.('(min-width: 56rem)').matches ? brand : previousFocus
        target?.focus({ preventScroll: true })
      }
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      id="site-menu"
      className="site-menu"
      aria-modal="true"
      aria-labelledby="site-menu-title"
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled)',
        )
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }}
    >
      <div className="site-menu-heading">
        <h2 id="site-menu-title">여정의 시작</h2>
        <button ref={closeButton} type="button" onClick={onDismiss}>
          메뉴 닫기
        </button>
      </div>
      <nav aria-label="전체 탐색">
        <NavigationLinks loggingOut={loggingOut} onLogout={onLogout} onNavigate={onDismiss} />
      </nav>
    </dialog>
  )
}

export function SiteHeader({
  loggingOut,
  onLogout,
}: {
  loggingOut: boolean
  onLogout: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  // RootLayout keys the Header by Router location so Back/Forward also dismiss it.
  useEffect(() => {
    const dismiss = () => setMenuOpen(false)
    const media = window.matchMedia?.('(min-width: 56rem)')
    if (!media) return
    media.addEventListener('change', dismiss)
    return () => media.removeEventListener('change', dismiss)
  }, [])
  return (
    <header className="site-header">
      <Link className="site-brand" to={routePaths.home} aria-label="Reservation Platform">
        <span className="site-brand-mark" aria-hidden="true">
          R
        </span>
        <span className="site-brand-name">
          Reservation <span>Platform</span>
        </span>
      </Link>
      <nav className="site-nav" aria-label="주요 탐색">
        <NavigationLinks loggingOut={loggingOut} onLogout={onLogout} />
      </nav>
      <div className="site-mobile-actions">
        <NavLink className="site-explore" to={routePaths.accommodations}>
          둘러보기
        </NavLink>
        <button
          type="button"
          className="site-menu-trigger"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? 'site-menu' : undefined}
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(true)}
        >
          메뉴
        </button>
      </div>
      {menuOpen && (
        <SiteMenu
          onDismiss={() => setMenuOpen(false)}
          loggingOut={loggingOut}
          onLogout={onLogout}
        />
      )}
    </header>
  )
}
