import type { ReactNode } from 'react'

// Display only. Query status, availability and allowed recovery actions stay with the caller.
export function EmptyState({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div className="ui-state ui-empty empty-state">
      <p role="status" aria-atomic="true">
        {message}
      </p>
      {children}
    </div>
  )
}
