import { useEffect, useState } from 'react'
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

type SearchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; result: AccommodationPageResponse }

export function AccommodationSearchPage() {
  const [request, setRequest] = useState<AccommodationSearchRequest>({
    status: 'ACTIVE',
    page: 0,
    size: 20,
  })
  const [state, setState] = useState<SearchState>({ status: 'loading' })
  useEffect(() => {
    const controller = new AbortController()
    searchAccommodations(request, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setState({ status: 'success', result })
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        const message =
          error instanceof ApiError && error.category === 'bad_request'
            ? '검색 조건을 확인해 주세요.'
            : error instanceof ApiError && error.category === 'forbidden'
              ? '숙소를 조회할 권한이 없습니다.'
              : '숙소를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
        setState({ status: 'error', message })
      },
    )
    return () => controller.abort()
  }, [request])
  function search(next: AccommodationSearchRequest) {
    setState({ status: 'loading' })
    setRequest(next)
  }
  return (
    <section className="accommodation-search-page" aria-labelledby="accommodation-search-title">
      <h1 id="accommodation-search-title">숙소 검색</h1>
      <p>운영 중인 숙소를 검색합니다. 날짜 입력 시 모든 숙박일의 예약 가능 여부를 확인합니다.</p>
      <p>가격 조건은 활성 객실의 기본 1박 가격이며 날짜별 가격이나 숙박 총액이 아닙니다.</p>
      <AccommodationSearchForm onSearch={search} />
      {state.status === 'loading' && <LoadingState message="숙소를 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={state.message} onRetry={() => search({ ...request })} />
      )}
      {state.status === 'success' && (
        <>
          <p role="status">총 {state.result.totalElements}개 숙소</p>
          <AccommodationList accommodations={state.result.content.map(toAccommodationCard)} />
          <nav className="accommodation-pagination" aria-label="숙소 페이지">
            <button
              disabled={state.result.first}
              onClick={() => search({ ...request, page: state.result.page - 1 })}
            >
              이전
            </button>
            <span>
              {state.result.totalPages ? state.result.page + 1 : 0} / {state.result.totalPages}{' '}
              페이지
            </span>
            <button
              disabled={state.result.last}
              onClick={() => search({ ...request, page: state.result.page + 1 })}
            >
              다음
            </button>
          </nav>
        </>
      )}
    </section>
  )
}
