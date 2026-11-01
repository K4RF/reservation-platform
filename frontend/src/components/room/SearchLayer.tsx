import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

const focusSelector =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]'
function controls(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(focusSelector)].filter(
    (item) =>
      item.tabIndex >= 0 &&
      !item.matches(':disabled') &&
      !item.closest('[hidden]') &&
      (!item.closest('details:not([open])') || item.tagName === 'SUMMARY'),
  )
}

/** Presentation only. The caller owns staged values, validation and explicit apply. */
export function SearchLayer({
  id,
  title,
  modal = true,
  anchor,
  onClose,
  children,
}: {
  id: string
  title: string
  modal?: boolean
  anchor: RefObject<HTMLButtonElement | null>
  onClose: () => void
  children: ReactNode
}) {
  const layer = useRef<HTMLDialogElement & HTMLDivElement>(null)
  const restoreFocus = useRef(true)
  useEffect(() => {
    const element = layer.current!
    const trigger = anchor.current
    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    restoreFocus.current = true
    if (modal) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      element.showModal()
    }
    function position() {
      const viewport = window.visualViewport
      const height = viewport?.height ?? window.innerHeight
      const top = viewport?.offsetTop ?? 0
      element.style.maxHeight = `${Math.max(0, Math.min(height - 24, window.innerHeight * 0.92))}px`
      if (modal) element.style.bottom = `${Math.max(0, window.innerHeight - height - top)}px`
      else if (trigger) {
        const rect = trigger.getBoundingClientRect()
        const { width, height: layerHeight } = element.getBoundingClientRect()
        const below = top + height - rect.bottom - 20
        const above = rect.top - top - 20
        const placeBelow = below >= layerHeight || below >= above
        element.style.maxHeight = `${Math.max(0, Math.min(height - 24, placeBelow ? below : above))}px`
        const actualHeight = element.getBoundingClientRect().height
        element.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`
        element.style.top = `${Math.max(top + 12, placeBelow ? rect.bottom + 8 : rect.top - actualHeight - 8)}px`
      }
    }
    position()
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(position) : null
    resize?.observe(element)
    controls(element)[0]?.focus({ preventScroll: true })
    function outside(event: PointerEvent) {
      if (
        !modal &&
        event.target instanceof Node &&
        !element.contains(event.target) &&
        !trigger?.contains(event.target)
      ) {
        restoreFocus.current = false
        onClose()
      }
    }
    document.addEventListener('pointerdown', outside, true)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      resize?.disconnect()
      document.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
      if (modal) {
        if (element.open) element.close()
        document.body.style.overflow = bodyOverflow
        document.documentElement.style.overflow = rootOverflow
      }
      if (restoreFocus.current && trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [modal, anchor, onClose])
  const Element = modal ? 'dialog' : 'div'
  return createPortal(
    <Element
      ref={layer}
      id={id}
      role="dialog"
      aria-modal={modal ? true : undefined}
      aria-labelledby={`${id}-title`}
      className={`search-layer ${modal ? 'search-layer-modal' : 'search-layer-popover'}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (!modal || event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose()
      }}
      onBlur={(event) => {
        if (
          !modal &&
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget) &&
          !anchor.current?.contains(event.relatedTarget)
        ) {
          restoreFocus.current = false
          onClose()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
          return
        }
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement)
          event.preventDefault()
        if (event.key !== 'Tab') return
        const items = controls(event.currentTarget)
        const first = items[0],
          last = items[items.length - 1]
        if (modal && event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          if (modal) first?.focus()
          else {
            const trigger = anchor.current
            const form = trigger?.closest('form')
            const siblings = form ? controls(form) : []
            const next = trigger ? siblings[siblings.indexOf(trigger) + 1] : null
            restoreFocus.current = false
            onClose()
            ;(next ?? trigger)?.focus({ preventScroll: true })
          }
        } else if (!modal && event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          onClose()
        }
      }}
    >
      <div className="search-layer-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        <button type="button" onClick={onClose} aria-label={`${title} 닫기`}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {children}
    </Element>,
    document.body,
  )
}
