import { Link } from 'react-router'
import { adminSections, adminSectionPath } from '../../app/adminSections'
import { AdminPageHeading } from '../../components/admin/AdminPageHeading'

export function AdminHomePage() {
  return (
    <section aria-labelledby="admin-home-heading">
      <AdminPageHeading id="admin-home-heading" title="관리 홈" context="작업 영역 선택" />
      <ul className="admin-area-list" aria-label="지원하는 관리 작업">
        {adminSections.map((section) => (
          <li key={section.path}>
            <h3>
              <Link to={adminSectionPath(section)}>{section.label}로 이동</Link>
            </h3>
            <p>{section.description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
