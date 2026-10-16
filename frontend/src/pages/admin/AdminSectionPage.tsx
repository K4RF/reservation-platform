import type { AdminSection } from '../../app/adminSections'

// Deliberate route entry, not a working CRUD form or an invented /api/v1/admin endpoint.
export function AdminSectionPage({ section }: { section: AdminSection }) {
  const headingId = `admin-${section.path}-heading`
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>{section.label}</h2>
      <p>{section.description}</p>
      <p role="status">관리 화면 준비 중</p>
      <p>
        해당 Backend API는 구현되어 있지만 이 화면에는 아직 연결하지 않았습니다. 현재는 조회·저장
        요청을 전송하지 않습니다.
      </p>
    </section>
  )
}
