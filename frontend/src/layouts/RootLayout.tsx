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
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <Link className="site-brand" to={routePaths.home}>
          Reservation Platform
        </Link>
        <nav className="site-nav" aria-label="주요 탐색">
          <NavLink
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            end
            to={routePaths.home}
          >
            홈
          </NavLink>
          <NavLink className="nav-link" to={routePaths.accommodations}>
            숙소 검색
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
          {state.status !== 'authenticated' && state.status !== 'loading' && (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
              to={routePaths.signup}
            >
              회원가입
            </NavLink>
          )}
          {state.status === 'loading' && <span role="status">인증 확인 중…</span>}
        </nav>
      </header>
      <main className="site-main" id="main-content">
        {state.status === 'reauth_required' && (
          <p role="status">
            로그인이 만료되었습니다. 숙소는 계속 둘러볼 수 있으며 예약 시 다시 로그인해 주세요.
          </p>
        )}
        {loggingOut ? <LoadingState message="로그아웃을 처리하고 있습니다." /> : <Outlet />}
      </main>
      <footer className="site-footer">Reservation Platform · 나에게 맞는 숙소, 편안한 여정</footer>
    </div>
  )
}
