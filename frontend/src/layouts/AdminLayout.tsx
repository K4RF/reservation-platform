import { Link, NavLink, Outlet } from 'react-router'
import { adminSections, adminSectionPath } from '../app/adminSections'
import { routePaths } from '../app/routePaths'

// Mounted only below the existing ADMIN ProtectedRoute; never a second authentication store.
export function AdminLayout() {
  return (
    <div className="admin-layout">
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <header className="admin-header">
            <p className="admin-workspace-label" lang="en">
              WORKSPACE
            </p>
            <h1>관리자 영역</h1>
          </header>
          <nav aria-label="관리 메뉴">
            <ul>
              <li>
                <NavLink
                  to={routePaths.admin}
                  end
                  aria-label="관리 홈"
                  className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
                >
                  <span className="admin-nav-wide">관리 홈</span>
                  <span className="admin-nav-narrow" aria-hidden="true">
                    홈
                  </span>
                </NavLink>
              </li>
              {adminSections.map((section) => (
                <li key={section.path}>
                  <NavLink
                    to={adminSectionPath(section)}
                    aria-label={section.label}
                    className={({ isActive }) =>
                      isActive ? 'nav-link nav-link-active' : 'nav-link'
                    }
                  >
                    <span className="admin-nav-wide">{section.label}</span>
                    <span className="admin-nav-narrow" aria-hidden="true">
                      {section.shortLabel}
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <Link className="admin-personal-link" to={routePaths.reservations}>
            내 예약으로 이동
          </Link>
        </aside>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
