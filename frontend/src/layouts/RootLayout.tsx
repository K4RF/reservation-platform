import { startTransition, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { useAuth } from '../state/useAuth'
import { LoadingState } from '../components/ui/LoadingState'
import { SiteHeader } from './SiteHeader'

function pageFrame(pathname: string) {
  if (pathname === routePaths.home) return 'home'
  if (pathname === routePaths.accommodations) return 'search'
  if (pathname.startsWith(`${routePaths.accommodations}/`)) return 'detail'
  if (pathname.startsWith(routePaths.reservations)) return 'booking'
  if (pathname.startsWith(routePaths.admin)) return 'admin'
  return 'reading'
}

export function RootLayout() {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const logoutPending = useRef(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (logoutPending.current) return
    logoutPending.current = true
    setLoggingOut(true)
    const result = await logout()
    logoutPending.current = false
    // Keep the protected Outlet unmounted until the Router's transition completes.
    startTransition(() => {
      if (result !== 'superseded') {
        navigate(routePaths.login, { replace: true, state: { logoutResult: result } })
      }
      setLoggingOut(false)
    })
  }
  useEffect(() => {
    if (
      !loggingOut &&
      state.status === 'reauth_required' &&
      !location.pathname.startsWith(routePaths.accommodations) &&
      location.pathname !== routePaths.home &&
      location.pathname !== routePaths.login
    ) {
      navigate(routePaths.login, {
        replace: true,
        state: { from: location.pathname + location.search + location.hash },
      })
    }
  }, [loggingOut, state.status, location.pathname, location.search, location.hash, navigate])
  // When a status replaces/precedes the Hero, never place an overlay over that message.
  const homeOverlay =
    location.pathname === routePaths.home && !loggingOut && state.status !== 'reauth_required'
  return (
    <div className={`app-shell${homeOverlay ? ' app-shell-home' : ''}`}>
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <SiteHeader key={location.key} loggingOut={loggingOut} onLogout={() => void handleLogout()} />
      <main
        className="site-main"
        data-page-frame={pageFrame(location.pathname)}
        id="main-content"
        tabIndex={-1}
      >
        {state.status === 'reauth_required' && (
          <p role="status">
            로그인이 만료되었습니다. 숙소는 계속 둘러볼 수 있으며 예약 시 다시 로그인해 주세요.
          </p>
        )}
        {loggingOut ? <LoadingState message="로그아웃을 처리하고 있습니다." /> : <Outlet />}
      </main>
      <footer className="site-footer">
        <span className="site-footer-brand">Reservation Platform</span>
        <span>나에게 맞는 숙소, 편안한 여정</span>
      </footer>
    </div>
  )
}
