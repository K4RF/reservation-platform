import { useId, useRef, useState, type ReactNode } from 'react'

type Panel = { id: string; label: string; shortLabel?: string; content: ReactNode }

// Panel changes are presentation only. Keep all current record forms, results and
// Media recovery mounted; the owning page still controls every read and write.
export function AdminPanels({ panels, locked }: { panels: Panel[]; locked: boolean }) {
  const [selected, setSelected] = useState(panels[0].id)
  const prefix = useId()
  const panel = useRef<HTMLElement>(null)
  return (
    <>
      <div className="admin-panel-switch" role="group" aria-label="레코드 작업">
        {panels.map(({ id, label, shortLabel }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={selected === id}
            aria-controls={`${prefix}-${id}`}
            disabled={locked && selected !== id}
            onClick={() => {
              if (!locked && selected !== id) setSelected(id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && selected === id) {
                event.preventDefault()
                panel.current?.focus()
              }
            }}
          >
            {shortLabel ? (
              <>
                <span className="admin-nav-wide">{label}</span>
                <span className="admin-nav-narrow" aria-hidden="true">
                  {shortLabel}
                </span>
              </>
            ) : (
              label
            )}
          </button>
        ))}
      </div>
      {panels.map(({ id, label, content }) => (
        <section
          key={id}
          ref={selected === id ? panel : undefined}
          id={`${prefix}-${id}`}
          className="admin-record-panel"
          aria-label={`${label} 패널`}
          tabIndex={-1}
          hidden={selected !== id}
        >
          {content}
        </section>
      ))}
    </>
  )
}
