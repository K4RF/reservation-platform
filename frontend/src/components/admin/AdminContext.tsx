import { Link } from 'react-router'
import type { ReactNode } from 'react'
import type { RoomResponse } from '../../api/room'

export function AdminBreadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="admin-breadcrumb" aria-label="관리 경로">
      <ol>
        {items.map(({ label, to }, index) => (
          <li key={index}>
            {to ? (
              <Link to={to}>{label}</Link>
            ) : (
              <span aria-current={index === items.length - 1 ? 'page' : undefined}>{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function AdminRoomTarget({
  room,
  label,
  linkLabel,
  children,
}: {
  room: RoomResponse
  label: string
  linkLabel: string
  children?: ReactNode
}) {
  return (
    <section className="admin-record-bar" aria-label={label}>
      <div>
        <strong>{room.name}</strong>{' '}
        <span className="admin-status-badge" data-status={room.status}>
          {room.status === 'ACTIVE' ? '운영 중' : '운영 중지'}
        </span>
        <p>
          <Link to={`/admin/accommodations/${room.accommodationId}`}>
            숙소 #{room.accommodationId}
          </Link>{' '}
          / 객실 #{room.roomId}
        </p>
      </div>
      <div className="action-group">
        <Link
          className="nav-link"
          to={`/admin/rooms/${room.roomId}?accommodationId=${room.accommodationId}`}
        >
          {linkLabel}
        </Link>
        {children}
      </div>
    </section>
  )
}

// An inherited ID still participates in form submission. Direct ID entry remains
// available without forcing users to repeat a selection made in the catalog.
export function AdminDirectId({ selected, children }: { selected: boolean; children: ReactNode }) {
  if (!selected) return children
  return (
    <details className="admin-disclosure">
      <summary>다른 ID로 선택</summary>
      {children}
    </details>
  )
}
