import { Link, NavLink, Outlet } from 'react-router'
import { routePaths } from '../app/routePaths'
import { useAuth } from '../state/useAuth'

export function RootLayout() {
  const { state, clearAuthentication } = useAuth()
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
          {state.status === 'authenticated' ? (
            <button className="nav-link nav-action" type="button" onClick={clearAuthentication}>
              브라우저 인증 종료
            </button>
          ) : (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
              to={routePaths.login}
            >
              로그인
            </NavLink>
          )}
          <NavLink
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            to={routePaths.signup}
          >
            회원가입
          </NavLink>
        </nav>
      </header>
      <main className="site-main" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
