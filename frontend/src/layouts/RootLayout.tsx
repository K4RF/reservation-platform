import { Link, NavLink, Outlet } from 'react-router'
import { routePaths } from '../app/routePaths'

export function RootLayout() {
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
        </nav>
      </header>
      <main className="site-main" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
