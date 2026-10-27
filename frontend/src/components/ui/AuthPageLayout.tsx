import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { routePaths } from '../../app/routePaths'

// Presentation only. Pages keep authentication, return context, guards and request state.
export function AuthPageLayout({
  className,
  headingId,
  eyebrow,
  title,
  description,
  children,
}: {
  className: string
  headingId: string
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <section className={`page-content auth-page ${className}`} aria-labelledby={headingId}>
      <div className="auth-panel">
        <div className="auth-header">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h1 id={headingId}>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </div>
      <aside className="auth-introduction" aria-label="공개 탐색 안내">
        <p className="auth-eyebrow">RESERVATION PLATFORM</p>
        <p className="auth-brand-title">Your next chapter.</p>
        <p>당신의 다음 머무름을 차분히 준비하세요.</p>
        <p className="auth-public-note">숙소 탐색에는 로그인이 필요하지 않습니다.</p>
        <Link to={routePaths.accommodations}>로그인 없이 숙소 둘러보기</Link>
      </aside>
    </section>
  )
}
