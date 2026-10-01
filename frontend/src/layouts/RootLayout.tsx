import { startTransition, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { routePaths } from '../app/routePaths'
import { useAuth } from '../state/useAuth'
import { LoadingState } from '../components/ui/LoadingState'

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
      location.pathname !== routePaths.login
    ) {
      navigate(routePaths.login, {
        replace: true,
        state: { from: location.pathname + location.search + location.hash },
      })
    }
  }, [loggingOut, state.status, location.pathname, location.search, location.hash, navigate])
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <Link className="site-brand" to={routePaths.home}>
          Reservation Platform
        </Link>
        <nav aria-label="주요 탐색">
          <NavLink
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            end
            to={routePaths.home}
          >
            홈
          </NavLink>
          {state.status === 'authenticated' &&
            (state.role === 'USER' || state.role === 'ADMIN') && (
              <NavLink className="nav-link" to={routePaths.reservations}>
                내 예약
              </NavLink>
            )}
          {state.status === 'authenticated' && state.role === 'ADMIN' && (
            <NavLink className="nav-link" to={routePaths.admin}>
              관리자
            </NavLink>
          )}
          {state.status === 'authenticated' ? (
            <button
              className="nav-link nav-action"
              type="button"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              {loggingOut ? '로그아웃 중…' : '로그아웃'}
            </button>
          ) : state.status !== 'loading' ? (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
              to={routePaths.login}
            >
              로그인
            </NavLink>
          ) : null}
          <NavLink
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            to={routePaths.signup}
          >
            회원가입
          </NavLink>
        </nav>
      </header>
      <main className="site-main" id="main-content">
        {loggingOut ? <LoadingState message="로그아웃을 처리하고 있습니다." /> : <Outlet />}
      </main>
    </div>
  )
}
