import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { routePaths } from '../../app/routePaths'

// Presentation only. Pages keep authentication, return context, guards and request state.
export function AuthPageLayout({
  headingId,
  eyebrow,
  title,
  description,
  variant = 'form',
  children,
}: {
  headingId: string
  eyebrow: string
  title: string
  description: string
  variant?: 'form' | 'notice'
  children?: ReactNode
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [headingId])

  return (
    <section className={`auth-page auth-page-${variant}`} aria-labelledby={headingId}>
      <div className="auth-header">
        <p className="auth-eyebrow" lang="en">
          {eyebrow}
        </p>
        <h1 id={headingId} ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p>{description}</p>
      </div>
      <div className="auth-panel">{children}</div>
    </section>
  )
}

export function AuthExploreLink({ to = routePaths.accommodations }: { to?: string }) {
  return (
    <Link className="auth-return-link" to={to}>
      {to === routePaths.accommodations
        ? '숙소 둘러보기'
        : to.startsWith(`${routePaths.accommodations}?`)
          ? '검색 결과로 돌아가기'
          : '보던 숙소로 돌아가기'}
    </Link>
  )
}
