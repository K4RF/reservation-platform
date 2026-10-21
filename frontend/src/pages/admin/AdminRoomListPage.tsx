import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getAccommodation } from '../../api/accommodation'
import { roomAmenities } from '../../api/accommodation'
import { searchAccommodationRooms } from '../../api/room'
import { RoomCard } from '../../components/room/RoomCard'
import { adminErrorMessage } from '../../components/admin/useAdminMutation'
import { LoadingState } from '../../components/ui/LoadingState'
import { ErrorState } from '../../components/ui/ErrorState'
import { useDetailQuery } from '../useDetailQuery'
import { adminRoomSearchFields, readAdminRoomQuery, roomSortFields } from './adminRoomQuery'
import { adminDailyPricePath } from './adminDailyPriceQuery'
import { adminInventoryPath } from './adminInventoryQuery'

export function AdminRoomListPage() {
  const [params, setParams] = useSearchParams()
  const query = readAdminRoomQuery(params)
  return (
    <section aria-labelledby="admin-rooms-heading">
      <h2 id="admin-rooms-heading">객실 관리</h2>
      <p>
        숙소별 모든 운영 상태의 객실을 조회합니다. 삭제 기능은 없으며 기본 가격과 날짜별 가격은
        별도입니다.
      </p>
      <Link to="/admin/accommodations">숙소 관리 목록에서 선택</Link>
      <form
        key={params.get('accommodationId') ?? ''}
        className="admin-form admin-query-form"
        aria-label="관리 숙소 선택"
        onSubmit={(event) => {
          event.preventDefault()
          const id = String(new FormData(event.currentTarget).get('accommodationId') ?? '').trim()
          // A different accommodation starts a new list: no previous filters/page/room selection survive.
          setParams(id ? { accommodationId: id } : {})
        }}
      >
        <div className="form-field">
          <label htmlFor="room-accommodation-id">관리할 숙소 ID</label>
          <input
            id="room-accommodation-id"
            name="accommodationId"
            inputMode="numeric"
            required
            defaultValue={params.get('accommodationId') ?? ''}
          />
        </div>
        <button type="submit">숙소 선택</button>
      </form>
      {!query ? (
        <>
          <ErrorState message="객실 관리 숙소 ID 또는 검색 조건이 올바르지 않습니다." />
          <button onClick={() => setParams({})}>객실 검색 초기화</button>
        </>
      ) : query.accommodationId === null ? (
        <p>숙소 관리의 객실 관리 링크를 이용하거나 숙소 ID를 입력하세요.</p>
      ) : (
        <RoomManagementList
          key={params.toString()}
          accommodationId={query.accommodationId}
          params={params}
          onParams={setParams}
        />
      )}
    </section>
  )
}
function RoomManagementList({
  accommodationId,
  params,
  onParams,
}: {
  accommodationId: number
  params: URLSearchParams
  onParams: (params: URLSearchParams) => void
}) {
  const queryString = params.toString()
  const request = readAdminRoomQuery(params)!.request
  const load = useCallback(
    async (signal: AbortSignal) => {
      const query = readAdminRoomQuery(new URLSearchParams(queryString))!
      const accommodation = await getAccommodation(accommodationId, signal)
      const rooms = await searchAccommodationRooms(accommodationId, query.request, signal)
      return { accommodation, rooms }
    },
    [accommodationId, queryString],
  )
  const { state, retry } = useDetailQuery(load)
  function onPage(page: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(page))
    onParams(next)
  }
  return (
    <>
      <form
        className="admin-form admin-query-form"
        aria-label="객실 관리 검색"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget),
            next = new URLSearchParams({ accommodationId: String(accommodationId), page: '0' })
          for (const field of adminRoomSearchFields)
            for (const value of data.getAll(field)) {
              if (String(value).trim()) next.append(field, String(value).trim())
            }
          onParams(next)
        }}
      >
        {(['minCapacity', 'minPrice', 'maxPrice'] as const).map((field, index) => (
          <div className="form-field" key={field}>
            <label htmlFor={`room-search-${field}`}>
              {['최소 수용 인원', '최소 기본 가격', '최대 기본 가격'][index]}
            </label>
            <input
              id={`room-search-${field}`}
              name={field}
              inputMode={index === 0 ? 'numeric' : 'decimal'}
              defaultValue={request[field]}
            />
          </div>
        ))}
        <div className="form-field">
          <label htmlFor="room-search-status">객실 상태 필터</label>
          <select id="room-search-status" name="status" defaultValue={request.status ?? ''}>
            <option value="">전체 상태</option>
            <option value="ACTIVE">운영 중</option>
            <option value="INACTIVE">운영 중지</option>
          </select>
        </div>
        <fieldset>
          <legend>필수 객실 편의시설 (모두 포함)</legend>
          {roomAmenities.map((amenity) => (
            <label className="admin-check" key={amenity}>
              <input
                type="checkbox"
                name="amenities"
                value={amenity}
                defaultChecked={request.amenities?.includes(amenity)}
              />
              {amenity === 'WIFI' ? '와이파이' : '에어컨'}
            </label>
          ))}
        </fieldset>
        <div className="form-field">
          <label htmlFor="room-search-sort">객실 정렬 필드</label>
          <select id="room-search-sort" name="sortBy" defaultValue={request.sortBy}>
            {roomSortFields.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="room-search-direction">객실 정렬 방향</label>
          <select id="room-search-direction" name="direction" defaultValue={request.direction}>
            <option value="ASC">오름차순</option>
            <option value="DESC">내림차순</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="room-search-size">객실 페이지 크기</label>
          <input
            id="room-search-size"
            name="size"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={request.size}
          />
        </div>
        <button type="submit">객실 검색</button>
      </form>
      {state.status === 'loading' && (
        <LoadingState message="숙소와 관리 객실 목록을 불러오고 있습니다." />
      )}
      {state.status === 'error' && (
        <ErrorState message={adminErrorMessage(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <>
          <h3>
            {state.data.accommodation.name} (숙소 ID {accommodationId})
          </h3>
          <p>숙소 상태: {state.data.accommodation.status === 'ACTIVE' ? '운영 중' : '운영 중지'}</p>
          <Link
            className="nav-link primary-action"
            to={`/admin/rooms/new?accommodationId=${accommodationId}`}
          >
            새 객실 생성
          </Link>
          <p role="status">총 {state.data.rooms.totalElements}개 객실</p>
          <button onClick={retry}>객실 목록 새로 조회</button>
          {!state.data.rooms.content.length ? (
            <p className="admin-empty-state">검색 조건에 맞는 객실이 없습니다.</p>
          ) : (
            <ul className="admin-catalog-list">
              {state.data.rooms.content.map((room) => (
                <li key={room.roomId}>
                  <RoomCard room={room} />
                  <Link to={`/admin/rooms/${room.roomId}?accommodationId=${accommodationId}`}>
                    {room.name} 조회·편집 (ID {room.roomId})
                  </Link>
                  <Link className="nav-link" to={adminDailyPricePath(room.roomId)}>
                    {room.name} 날짜별 가격 관리
                  </Link>
                  <Link className="nav-link" to={adminInventoryPath(room.roomId)}>
                    {room.name} 날짜별 재고 관리
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <nav className="accommodation-pagination" aria-label="관리 객실 페이지">
            <button
              disabled={state.data.rooms.first}
              onClick={() => onPage(state.data.rooms.page - 1)}
            >
              이전
            </button>
            <span>
              {state.data.rooms.totalPages ? state.data.rooms.page + 1 : 0} /{' '}
              {state.data.rooms.totalPages} 페이지
            </span>
            <button
              disabled={state.data.rooms.last}
              onClick={() => onPage(state.data.rooms.page + 1)}
            >
              다음
            </button>
          </nav>
          {!state.data.rooms.content.length && state.data.rooms.page > 0 && (
            <button onClick={() => onPage(0)}>첫 페이지로 이동</button>
          )}
        </>
      )}
    </>
  )
}
