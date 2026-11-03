import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react'
import type { AccommodationSearchRequest } from '../../api/accommodation'
import { parseSearchQuery, toSearchParams, type AccommodationSearchQuery } from './searchQuery'
import { CompactSearchBar } from '../room/CompactSearchBar'
import { SearchLayer } from '../room/SearchLayer'
import { AccommodationFilters } from './AccommodationFilters'
import { filterValues, filterLabels, resetFilters, searchContextLabel } from './searchFilters'

const narrowQuery = '(max-width: 64rem)'
function subscribe(change: () => void) {
  const media = window.matchMedia?.(narrowQuery)
  media?.addEventListener('change', change)
  return () => media?.removeEventListener('change', change)
}
export function AccommodationSearchForm({
  onSearch,
  initialQuery,
  summary,
  resultCount,
  children,
}: {
  onSearch: (request: AccommodationSearchRequest) => void
  initialQuery: AccommodationSearchQuery
  summary: ReactNode
  resultCount?: number
  children: ReactNode
}) {
  const narrow = useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(narrowQuery).matches ?? false,
    () => false,
  )
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [cityDraft, setCityDraft] = useState(initialQuery.city ?? '')
  const [guestCount, setGuestCount] = useState(String(initialQuery.guestCount ?? ''))
  const [dates, setDates] = useState({
    checkInDate: initialQuery.checkInDate ?? '',
    checkOutDate: initialQuery.checkOutDate ?? '',
  })
  const [draft, setDraft] = useState(initialQuery)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const sidebarHeading = useRef<HTMLHeadingElement>(null)
  const filterErrorNode = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (filterError) filterErrorNode.current?.focus()
  }, [filterError])
  const close = useCallback(() => {
    setOpen(false)
    setDraft(initialQuery)
    setFilterError('')
    // The Mobile trigger disappears after a wide resize; hand focus to the new sidebar.
    if (!window.matchMedia?.(narrowQuery).matches)
      requestAnimationFrame(() => sidebarHeading.current?.focus({ preventScroll: true }))
  }, [initialQuery])
  function commit(next: AccommodationSearchRequest, filters = false) {
    const parsed = parseSearchQuery(toSearchParams({ ...next, page: 0 }))
    if (!parsed.valid) {
      if (filters) setFilterError(parsed.message)
      else setError(parsed.message)
      return
    }
    setError('')
    setFilterError('')
    setOpen(false)
    onSearch(parsed.query)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const city = String(new FormData(event.currentTarget).get('city') ?? '').trim()
    // Commit this editor only, not another editor's unsubmitted draft.
    commit({
      ...initialQuery,
      city: city || undefined,
      checkInDate: dates.checkInDate || undefined,
      checkOutDate: dates.checkOutDate || undefined,
      guestCount: guestCount ? Number(guestCount) : undefined,
    })
  }
  const labels = filterLabels(initialQuery)
  const compactDirty =
    cityDraft.trim() !== (initialQuery.city ?? '') ||
    dates.checkInDate !== (initialQuery.checkInDate ?? '') ||
    dates.checkOutDate !== (initialQuery.checkOutDate ?? '') ||
    (guestCount === '' ? undefined : Number(guestCount)) !== initialQuery.guestCount
  const editor = (
    <form
      className="search-filter-editor"
      aria-label="상세 검색 조건"
      onSubmit={(event) => {
        event.preventDefault()
        commit({ ...initialQuery, ...filterValues(draft) }, true)
      }}
    >
      <AccommodationFilters draft={draft} onChange={setDraft} />
      {filterError && (
        <p ref={filterErrorNode} className="ui-state ui-error" role="alert" tabIndex={-1}>
          {filterError}
        </p>
      )}
      <div className="search-filter-actions">
        <button
          type="button"
          onClick={() => {
            setDraft(resetFilters(initialQuery))
            setFilterError('')
          }}
        >
          필터 초기화
        </button>
        {open && (
          <button type="button" onClick={close}>
            필터 취소
          </button>
        )}
        <button type="submit" className="search-filter-apply">
          조건 적용
        </button>
      </div>
    </form>
  )
  return (
    <div className="catalog-search-form">
      <form
        className="accommodation-search-form search-conditions-form"
        onSubmit={submit}
        aria-label="숙소 검색 조건"
      >
        <CompactSearchBar
          prefix="search"
          city={{ initial: initialQuery.city, onChange: setCityDraft }}
          required={false}
          dates={dates}
          onDateChange={(field, value) => {
            setDates((current) => ({ ...current, [field]: value }))
            setError('')
          }}
          guestCount={guestCount}
          onGuestChange={(value) => {
            setGuestCount(value)
            setError('')
          }}
          actionLabel="검색"
          error={error}
        />
      </form>
      {compactDirty && (
        <p className="search-filter-summary search-draft-notice" role="status">
          변경 사항은 검색 후 반영됩니다. 현재 조회: {searchContextLabel(initialQuery)}
        </p>
      )}
      <div className="search-comparison-layout">
        {!narrow && !open && (
          <aside className="search-filters" aria-label="상세 검색 필터">
            <h2 ref={sidebarHeading} tabIndex={-1}>
              원하는 머무름
            </h2>
            {editor}
          </aside>
        )}
        <div className="search-results-column">
          <div className="sr-only">{summary}</div>
          <div className="search-result-tools">
            {(narrow || open) && (
              <button
                type="button"
                ref={trigger}
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? 'search-filter-sheet' : undefined}
              >
                필터{labels.length ? ` (${labels.length})` : ''}
              </button>
            )}
            {resultCount !== undefined && (
              <p className="search-result-count" role="status">
                총 {resultCount}개 숙소
              </p>
            )}
            <label className="search-sort-controls">
              <span className="sr-only">숙소 정렬</span>
              <select
                value={`${initialQuery.sortBy}:${initialQuery.direction}`}
                onChange={(event) => {
                  const [sortBy, direction] = event.target.value.split(':') as [
                    'ID' | 'NAME',
                    'ASC' | 'DESC',
                  ]
                  commit({ ...initialQuery, sortBy, direction })
                }}
              >
                <option value="ID:ASC">등록순</option>
                <option value="ID:DESC">최근 등록순</option>
                <option value="NAME:ASC">이름 오름차순</option>
                <option value="NAME:DESC">이름 내림차순</option>
              </select>
            </label>
          </div>
          {labels.length > 0 && (
            <p className="search-filter-summary" aria-label="적용된 필터">
              {labels.join(' · ')}
            </p>
          )}
          {initialQuery.status === 'INACTIVE' && (
            <p className="search-filter-summary">운영 중지 숙소를 조회하고 있습니다.</p>
          )}
          {children}
        </div>
      </div>
      {open && (
        <SearchLayer
          id="search-filter-sheet"
          title="상세 검색 필터"
          anchor={trigger}
          onClose={close}
        >
          <p className="search-filter-summary">
            현재 적용: {[searchContextLabel(initialQuery), ...labels].join(' · ')}
          </p>
          {editor}
        </SearchLayer>
      )}
    </div>
  )
}
