import { useEffect, useMemo, useState, useRef } from 'react'
import { restoreSearchPosition } from '../app/explorationPosition'
import { useSearchParams, useLocation, useNavigationType } from 'react-router'
import {
  searchAccommodations,
  type AccommodationPageResponse,
  type AccommodationSearchRequest,
} from '../api/accommodation'
import { ApiError } from '../api/errors'
import { AccommodationList } from '../components/accommodation/AccommodationList'
import { AccommodationSearchForm } from '../components/accommodation/AccommodationSearchForm'
import { toAccommodationCard } from '../components/accommodation/accommodationView'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import {
  defaultSearchQuery,
  parseSearchQuery,
  toSearchParams,
  canonicalSearchQuery,
} from '../components/accommodation/searchQuery'

type SearchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; result: AccommodationPageResponse }

export function AccommodationSearchPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigationType = useNavigationType()
  const restoredEntry = useRef<string | null>(null)
  const queryKey = params.toString()
  const heading = useRef<HTMLHeadingElement>(null)
  const parsed = useMemo(() => parseSearchQuery(new URLSearchParams(queryKey)), [queryKey])
  const [retry, setRetry] = useState(0)
  const [response, setResponse] = useState<{ key: string; retry: number; state: SearchState }>()
  const state: SearchState =
    response?.key === queryKey && response.retry === retry ? response.state : { status: 'loading' }
  useEffect(() => {
    if (state.status === 'success' && parsed.valid && restoredEntry.current !== location.key) {
      restoredEntry.current = location.key
      if (navigationType === 'POP' || location.state?.restoreSearchPosition === true)
        restoreSearchPosition(canonicalSearchQuery(queryKey)!, heading.current)
    }
  }, [state.status, parsed.valid, queryKey, location.key, location.state, navigationType])
  useEffect(() => {
    const controller = new AbortController()
    if (!parsed.valid) return () => controller.abort()
    searchAccommodations(parsed.query, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted)
          setResponse({ key: queryKey, retry, state: { status: 'success', result } })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const message =
          error instanceof ApiError && error.category === 'bad_request'
            ? '검색 조건을 확인해 주세요.'
            : error instanceof ApiError && error.category === 'forbidden'
              ? '숙소를 조회할 권한이 없습니다.'
              : '숙소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
        setResponse({ key: queryKey, retry, state: { status: 'error', message } })
      },
    )
    return () => controller.abort()
  }, [parsed, queryKey, retry])
  function search(next: AccommodationSearchRequest) {
    const nextParams = toSearchParams(next)
    if (nextParams.toString() === queryKey) setRetry((value) => value + 1)
    else setParams(nextParams)
  }
  return (
    <section className="accommodation-search-page" aria-labelledby="accommodation-search-title">
      <header className="search-page-header">
        <p className="eyebrow">EXPLORE STAYS</p>
        <h1 ref={heading} tabIndex={-1} id="accommodation-search-title">
          숙소 검색
        </h1>
        <p>숙소를 검색합니다. 날짜 입력 시 모든 숙박일의 예약 가능 여부를 확인합니다.</p>
      </header>
      <p className="search-price-note">
        가격 조건은 활성 객실의 기본 1박 가격이며 날짜별 가격이나 숙박 총액이 아닙니다.
      </p>
      <AccommodationSearchForm
        key={queryKey}
        initialQuery={parsed.valid ? parsed.query : defaultSearchQuery}
        onSearch={search}
      />
      {!parsed.valid && <ErrorState message={parsed.message} />}
      {parsed.valid && state.status === 'loading' && (
        <LoadingState message="숙소를 불러오고 있습니다." />
      )}
      {parsed.valid && state.status === 'error' && (
        <ErrorState message={state.message} onRetry={() => setRetry((value) => value + 1)} />
      )}
      {parsed.valid && state.status === 'success' && (
        <>
          <p className="search-result-count" role="status">
            총 {state.result.totalElements}개 숙소
          </p>
          <AccommodationList accommodations={state.result.content.map(toAccommodationCard)} />
          <nav className="accommodation-pagination" aria-label="숙소 페이지">
            <button
              disabled={state.result.first}
              onClick={() => search({ ...parsed.query, page: state.result.page - 1 })}
            >
              이전
            </button>
            <span>
              {state.result.totalPages ? state.result.page + 1 : 0} / {state.result.totalPages}{' '}
              페이지
            </span>
            <button
              disabled={state.result.last}
              onClick={() => search({ ...parsed.query, page: state.result.page + 1 })}
            >
              다음
            </button>
          </nav>
        </>
      )}
    </section>
  )
}
