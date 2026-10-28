import { Link, NavLink, Outlet } from 'react-router'
import { adminSections, adminSectionPath } from '../app/adminSections'
import { routePaths } from '../app/routePaths'

// Mounted only below the existing ADMIN ProtectedRoute; never a second authentication store.
export function AdminLayout() {
  return (
    <div className="admin-layout">
      <header className="admin-header">
        <p className="admin-workspace-label">ADMIN WORKSPACE</p>
        <h1>관리자 영역</h1>
        <p>숙소·객실·가격·재고 관리 화면의 공통 작업 공간입니다.</p>
        <span className="admin-header-note">조회로 확인하고, 변경은 명시적으로 저장합니다.</span>
      </header>
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <p className="admin-menu-title">관리 메뉴</p>
          <nav aria-label="관리 메뉴">
            <ul>
              <li>
                <NavLink
                  to={routePaths.admin}
                  end
                  className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
                >
                  관리 홈
                </NavLink>
              </li>
              {adminSections.map((section) => (
                <li key={section.path}>
                  <NavLink
                    to={adminSectionPath(section)}
                    className={({ isActive }) =>
                      isActive ? 'nav-link nav-link-active' : 'nav-link'
                    }
                  >
                    {section.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <p className="admin-sidebar-note">
            본인 예약은 <Link to={routePaths.reservations}>내 예약으로 이동</Link>하여 관리합니다.
          </p>
          <p className="admin-sidebar-note">
            이 화면의 역할 표시는 UI 안내이며, 실제 권한은 각 API에서 서버가 검증합니다.
          </p>
        </aside>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
