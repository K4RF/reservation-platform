import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  getLocationSuggestions,
  locationQueryMaxLength,
  normalizeLocationQuery,
  type LocationSuggestion,
} from '../../api/locationSuggestions'

const debounceMs = 250
type Result = { query: string } & (
  { kind: 'ready'; suggestions: LocationSuggestion[] } | { kind: 'error' }
)

export type DestinationComboboxOptions = {
  initial?: string
  onChange?: (text: string) => void
  onSelect?: (suggestion: LocationSuggestion) => void
}

export function DestinationCombobox({
  id,
  initial = '',
  onChange,
  onSelect,
}: DestinationComboboxOptions & { id: string }) {
  const root = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [text, setText] = useState(initial)
  const [selected, setSelected] = useState<LocationSuggestion | null>(null)
  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [result, setResult] = useState<Result | null>(null)
  const query = open && !composing && !selected ? normalizeLocationQuery(text) : null
  const visibleResult = result?.query === query ? result : null
  const suggestions = visibleResult?.kind === 'ready' ? visibleResult.suggestions : []
  const listId = `${id}-locations`
  const activeId = suggestions[activeIndex] ? `${listId}-${activeIndex}` : undefined
  const panelOpen = query !== null
  const status = !panelOpen
    ? selected && `선택: ${selected.displayName}`
    : visibleResult === null
      ? '지역 후보를 찾는 중입니다.'
      : visibleResult.kind === 'error'
        ? '지역 후보를 불러오지 못했습니다. 직접 입력해 검색할 수 있습니다.'
        : suggestions.length === 0
          ? '일치하는 지역 후보가 없습니다. 직접 입력해 검색할 수 있습니다.'
          : `지역 후보 ${suggestions.length}개. 방향키로 이동하고 Enter로 선택하세요.`

  useEffect(() => {
    if (query === null) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      getLocationSuggestions(query, controller.signal).then(
        (matches) => {
          if (!controller.signal.aborted) setResult({ query, kind: 'ready', suggestions: matches })
        },
        () => {
          if (!controller.signal.aborted) setResult({ query, kind: 'error' })
        },
      )
    }, debounceMs)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const dismiss = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
    setResult(null)
  }, [])

  useEffect(() => {
    if (!open) return
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) dismiss()
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [dismiss, open])

  useLayoutEffect(() => {
    if (!panelOpen) return
    const viewport = window.visualViewport
    function placePopup() {
      const field = root.current?.getBoundingClientRect()
      if (!field || !popup.current) return
      const top = viewport?.offsetTop ?? 0
      const bottom = top + (viewport?.height ?? window.innerHeight)
      const below = bottom - field.bottom
      const above = field.top - top
      // Keep the date and guest row tappable in the stacked layout when there is room above.
      const stacked = window.matchMedia?.('(max-width: 48rem)').matches
      const flip = (stacked && above >= 160) || (below < 240 && above > below)
      popup.current.dataset.side = flip ? 'above' : 'below'
      popup.current.style.setProperty(
        '--destination-space',
        `${Math.max(0, (flip ? above : below) - 12)}px`,
      )
    }
    placePopup()
    window.addEventListener('resize', placePopup)
    window.addEventListener('scroll', placePopup, { passive: true })
    viewport?.addEventListener('resize', placePopup)
    viewport?.addEventListener('scroll', placePopup)
    return () => {
      window.removeEventListener('resize', placePopup)
      window.removeEventListener('scroll', placePopup)
      viewport?.removeEventListener('resize', placePopup)
      viewport?.removeEventListener('scroll', placePopup)
    }
  }, [panelOpen])

  useLayoutEffect(() => {
    const panel = popup.current
    const option = activeId ? document.getElementById(activeId) : null
    if (!panel || !option) return
    const viewport = panel.getBoundingClientRect()
    const row = option.getBoundingClientRect()
    if (row.bottom > viewport.bottom) panel.scrollTop += row.bottom - viewport.bottom
    else if (row.top < viewport.top) panel.scrollTop -= viewport.top - row.top
  }, [activeId])

  function edit(value: string) {
    if (selected || normalizeLocationQuery(value) !== normalizeLocationQuery(text)) {
      setResult(null)
      setActiveIndex(-1)
    }
    setSelected(null)
    setText(value)
    onChange?.(value)
  }

  function choose(suggestion: LocationSuggestion) {
    // Keep the legacy FormData text until the parent applies selected searchParams (#320).
    setSelected(suggestion)
    dismiss()
    onSelect?.(suggestion)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (composing || event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape' && panelOpen) {
      event.preventDefault()
      event.stopPropagation()
      dismiss()
    } else if (event.key === 'Enter' && suggestions[activeIndex]) {
      event.preventDefault()
      choose(suggestions[activeIndex])
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length) {
        event.preventDefault()
        setActiveIndex((index) =>
          event.key === 'ArrowDown'
            ? Math.min(index + 1, suggestions.length - 1)
            : index < 0
              ? suggestions.length - 1
              : Math.max(0, index - 1),
        )
      } else if (!open && !selected && normalizeLocationQuery(text) !== null) {
        event.preventDefault()
        setOpen(true)
      }
    }
  }

  return (
    <div ref={root} className="compact-city-field form-field">
      <label htmlFor={id}>여행지 · 도시명</label>
      <input type="hidden" name="city" value={text} />
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-describedby={`${id}-help`}
        autoComplete="off"
        maxLength={locationQueryMaxLength}
        value={selected?.displayName ?? text}
        placeholder="도시 또는 지역 이름"
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={dismiss}
        onChange={(event) => edit(event.currentTarget.value)}
        onCompositionStart={() => {
          setComposing(true)
          setResult(null)
          setActiveIndex(-1)
        }}
        onCompositionEnd={(event) => {
          setComposing(false)
          if (event.currentTarget.value !== (selected?.displayName ?? text))
            edit(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
      <span id={`${id}-help`} className={selected ? 'destination-selection-note' : 'sr-only'}>
        {selected
          ? `검색에는 직접 입력한 도시명(${text.trim()})이 사용됩니다.`
          : '도시의 정확한 이름으로 검색합니다.'}
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {status}
      </span>
      <div className="destination-popup" ref={popup} hidden={!panelOpen}>
        {panelOpen && suggestions.length === 0 && <p aria-hidden="true">{status}</p>}
        <ul id={listId} role="listbox" aria-label="지역 후보" hidden={!suggestions.length}>
          {suggestions.map((suggestion, index) => (
            <li
              id={`${listId}-${index}`}
              key={index}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              <span>{suggestion.displayName}</span>
              <small>
                {suggestion.searchParams.country} ·{' '}
                {suggestion.type === 'CITY' ? '도시' : suggestion.searchParams.city}
              </small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
