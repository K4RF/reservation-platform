import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { searchAccommodations } from '../../api/accommodation'
import type { AccommodationSearchRequest } from '../../api/accommodation'
import { toAccommodationCard } from '../../components/accommodation/accommodationView'
import { LoadingState } from '../../components/ui/LoadingState'
import { ErrorState } from '../../components/ui/ErrorState'
import { adminErrorMessage } from '../../components/admin/useAdminMutation'
import { useDetailQuery } from '../useDetailQuery'
import { adminRoomListPath } from './adminRoomQuery'

import {
  adminAccommodationSearchFields as fields,
  readAdminAccommodationQuery,
} from './adminAccommodationQuery'
export function AdminAccommodationListPage() {
  const [params, setParams] = useSearchParams()
  const query = readAdminAccommodationQuery(params)
  return (
    <section aria-labelledby="admin-accommodations-heading">
      <h2 id="admin-accommodations-heading">숙소 관리</h2>
      <p>
        공개 목록 API를 관리 조건으로 조회합니다. 기본값은 모든 운영 상태이며 삭제 기능은 없습니다.
      </p>
      <Link to="/admin/accommodations/new">새 숙소 생성</Link>
      {!query ? (
        <>
          <ErrorState message="숙소 관리 검색 조건이 올바르지 않습니다." />
          <button onClick={() => setParams({})}>검색 조건 초기화</button>
        </>
      ) : (
        <>
          <form
            key={params.toString()}
            className="admin-form"
            aria-label="숙소 관리 검색"
            onSubmit={(event) => {
              event.preventDefault()
              const data = new FormData(event.currentTarget),
                next = new URLSearchParams()
              for (const key of fields) {
                if (key === 'page') continue
                const value = String(data.get(key) ?? '').trim()
                if (value) next.set(key, value)
              }
              next.set('page', '0')
              setParams(next)
            }}
          >
            {(['name', 'city', 'region'] as const).map((key, index) => (
              <div className="form-field" key={key}>
                <label htmlFor={`admin-search-${key}`}>
                  {['숙소명 검색', '도시 (정확한 이름)', '지역 (정확한 이름)'][index]}
                </label>
                <input
                  id={`admin-search-${key}`}
                  name={key}
                  maxLength={100}
                  defaultValue={query[key]}
                />
              </div>
            ))}
            <div className="form-field">
              <label htmlFor="admin-search-status">운영 상태 필터</label>
              <select id="admin-search-status" name="status" defaultValue={query.status ?? ''}>
                <option value="">전체 상태</option>
                <option value="ACTIVE">운영 중</option>
                <option value="INACTIVE">운영 중지</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="admin-search-sort">정렬 필드</label>
              <select id="admin-search-sort" name="sortBy" defaultValue={query.sortBy}>
                <option value="ID">ID</option>
                <option value="NAME">숙소 이름</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="admin-search-direction">정렬 방향</label>
              <select id="admin-search-direction" name="direction" defaultValue={query.direction}>
                <option value="ASC">오름차순</option>
                <option value="DESC">내림차순</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="admin-search-size">페이지 크기</label>
              <input
                id="admin-search-size"
                name="size"
                type="number"
                min="1"
                max="100"
                step="1"
                required
                defaultValue={query.size}
              />
            </div>
            <button type="submit">숙소 검색</button>
          </form>
          <AccommodationResults
            query={query}
            onPage={(page) => {
              const next = new URLSearchParams(params)
              next.set('page', String(page))
              setParams(next)
            }}
          />
        </>
      )}
    </section>
  )
}
function AccommodationResults({
  query,
  onPage,
}: {
  query: AccommodationSearchRequest
  onPage: (page: number) => void
}) {
  const { name, city, region, status, page, size, sortBy, direction } = query
  const load = useCallback(
    (signal: AbortSignal) =>
      searchAccommodations({ name, city, region, status, page, size, sortBy, direction }, signal),
    [name, city, region, status, page, size, sortBy, direction],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <>
      {state.status === 'loading' && <LoadingState message="관리 숙소 목록을 불러오고 있습니다." />}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <p role="status">총 {state.data.totalElements}개 숙소</p>
          <button onClick={retry}>숙소 목록 새로 조회</button>
          {!state.data.content.length ? (
            <p>검색 조건에 맞는 숙소가 없습니다.</p>
          ) : (
            <ul className="admin-catalog-list">
              {state.data.content.map((row) => {
                const card = toAccommodationCard(row)
                return (
                  <li key={card.id}>
                    <Link to={`/admin/accommodations/${card.id}`}>
                      {card.name} (ID {card.id})
                    </Link>
                    <p>
                      {card.status} · {card.location}
                    </p>
                    <Link to={adminRoomListPath(card.id)}>{card.name} 객실 관리</Link>
                  </li>
                )
              })}
            </ul>
          )}
          <nav className="accommodation-pagination" aria-label="관리 숙소 페이지">
            <button disabled={state.data.first} onClick={() => onPage(state.data.page - 1)}>
              이전
            </button>
            <span>
              {state.data.totalPages ? state.data.page + 1 : 0} / {state.data.totalPages} 페이지
            </span>
            <button disabled={state.data.last} onClick={() => onPage(state.data.page + 1)}>
              다음
            </button>
          </nav>
          {!state.data.content.length && state.data.page > 0 && (
            <button onClick={() => onPage(0)}>첫 페이지로 이동</button>
          )}
        </>
      )}
    </>
  )
}
