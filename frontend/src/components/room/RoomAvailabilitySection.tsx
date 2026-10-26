import { useCallback, useState } from 'react'
import { getAvailableRooms } from '../../api/room'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import { useAvailabilityForm } from './useAvailabilityForm'
import { StayDateFields } from './StayDateFields'
import { GuestCountField } from './GuestCountField'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { EmptyState } from '../ui/EmptyState'
import { RoomCard } from './RoomCard'
import { BookingFlow } from '../booking/BookingFlow'
import { BookingSummary } from '../booking/BookingSummary'
import type { BookingContext } from '../../app/bookingContext'

interface AvailabilityProps {
  accommodationId: number
  accommodationName?: string
  onComplete?: (id: number) => void
  initialContext?: BookingContext | null
  onLoginRequired?: (context: BookingContext) => void
}

export function RoomAvailabilitySection({
  accommodationId,
  accommodationName,
  onComplete,
  initialContext,
  onLoginRequired,
}: AvailabilityProps) {
  // A keyed inner component also resets state if this component is reused for another accommodation.
  return (
    <AvailabilityForm
      key={accommodationId}
      accommodationId={accommodationId}
      accommodationName={accommodationName}
      onComplete={onComplete}
      initialContext={initialContext}
      onLoginRequired={onLoginRequired}
    />
  )
}

function AvailabilityForm({
  accommodationId,
  accommodationName,
  onComplete,
  initialContext,
  onLoginRequired,
}: AvailabilityProps) {
  const { draft, request, error, revision, change, submit } = useAvailabilityForm(
    initialContext?.stay ?? null,
  )
  return (
    <section className="room-availability" aria-labelledby="availability-title">
      <h2 id="availability-title" tabIndex={-1}>
        예약 가능한 객실 조회
      </h2>
      <p>조회 시점의 가용성입니다. 최종 예약 시 Backend가 재고와 가격을 다시 검증합니다.</p>
      <form className="accommodation-search-form" onSubmit={submit} aria-label="객실 가용성 조건">
        <StayDateFields prefix="availability" draft={draft} onChange={change} />
        <GuestCountField
          id="availability-guests"
          value={draft.guestCount}
          onChange={(value) => change('guestCount', value)}
        />
        <button type="submit">예약 가능 객실 조회</button>
      </form>
      {error && <ErrorState message={error} />}
      {!request && !error && (
        <p className="availability-guidance">날짜와 인원을 입력한 후 조회하세요.</p>
      )}
      {request && (
        <AvailabilityResults
          key={revision}
          accommodationId={accommodationId}
          accommodationName={accommodationName}
          onComplete={onComplete}
          request={request}
          initialContext={revision === 0 ? initialContext : null}
          onLoginRequired={onLoginRequired}
        />
      )}
    </section>
  )
}

function AvailabilityResults({
  accommodationId,
  accommodationName,
  onComplete,
  request,
  initialContext,
  onLoginRequired,
}: AvailabilityProps & { request: AvailabilityRequest }) {
  const [page, setPage] = useState(initialContext?.roomPage ?? 0)
  const [selectedId, setSelectedId] = useState<number | null>(initialContext?.roomId ?? null)
  const load = useCallback(
    (signal: AbortSignal) => getAvailableRooms(accommodationId, request, page, signal),
    [accommodationId, request, page],
  )
  const { state, retry } = useDetailQuery(load)
  if (state.status === 'loading')
    return <LoadingState message="예약 가능한 객실을 확인하고 있습니다." />
  if (state.status === 'error')
    return (
      <ErrorState
        message="가용성을 확인하지 못했습니다. 날짜·인원·숙소 예약 조건을 확인하고 다시 시도하세요."
        onRetry={() => {
          setSelectedId(null)
          retry()
        }}
      />
    )
  function move(next: number) {
    setSelectedId(null)
    setPage(next)
  }
  // URL selection is a hint, not authority. Restore only a room in the freshly fetched result.
  const selected = state.data.content.find((room) => room.roomId === selectedId)
  return (
    <div className="availability-results-layout">
      <div className="availability-room-results">
        {!state.data.content.length ? (
          <EmptyState message="선택한 조건에 예약 가능한 객실이 없습니다.">
            <p>
              다른 날짜나 인원으로 다시 조회해 보세요. 객실 운영 상태, 날짜별 잔여 재고와 숙소 예약
              정책에 따라 결과가 달라집니다.
            </p>
          </EmptyState>
        ) : (
          <ul className="accommodation-list" aria-label="예약 가능한 객실 목록">
            {state.data.content.map((room) => (
              <li
                className={`availability-room-item${selected?.roomId === room.roomId ? ' availability-room-selected' : ''}`}
                key={room.roomId}
              >
                <RoomCard
                  room={room}
                  detail={{
                    scope: `available:${accommodationId}:${request.checkInDate}:${request.checkOutDate}:${request.guestCount}:${page}`,
                    fallbackId: 'availability-title',
                    request,
                    onSelect: (chosen) => setSelectedId(chosen.roomId),
                  }}
                />
                {selected?.roomId === room.roomId && (
                  <>
                    <p className="room-selection-label">선택된 객실</p>
                    <a className="selection-review-jump" href="#room-selection-panel-title">
                      선택한 객실 확인하기 ↓
                    </a>
                  </>
                )}
                <button
                  className="primary-action"
                  type="button"
                  aria-pressed={selected?.roomId === room.roomId}
                  onClick={() => setSelectedId(room.roomId)}
                >
                  {room.name} 선택
                </button>
              </li>
            ))}
          </ul>
        )}
        <nav className="accommodation-pagination" aria-label="예약 가능 객실 페이지">
          <button disabled={state.data.first} onClick={() => move(state.data.page - 1)}>
            이전 가용 객실
          </button>
          <span>
            {state.data.totalPages ? state.data.page + 1 : 0} / {state.data.totalPages} 페이지
          </span>
          <button disabled={state.data.last} onClick={() => move(state.data.page + 1)}>
            다음 가용 객실
          </button>
        </nav>
        {selectedId && !selected && (
          <p role="status">
            이전에 선택한 객실은 현재 조건에서 이용할 수 없습니다. 다른 객실을 선택하세요.
          </p>
        )}
      </div>
      <aside className="room-selection-panel" aria-labelledby="room-selection-panel-title">
        <h3 id="room-selection-panel-title" tabIndex={-1}>
          선택한 객실 확인
        </h3>
        <p className="selection-panel-notice">
          선택은 예약 확정이 아닙니다. 날짜별 요금과 최종 가용성은 Backend가 다시 확인합니다.
        </p>
        {!selected && (
          <p className="selection-panel-empty">
            가용 객실을 비교한 후 객실을 선택해 주세요. 아직 예약은 생성되지 않았습니다.
          </p>
        )}
        {selected && (
          <div className="selected-room" role="status" aria-label="선택한 객실">
            <p className="selected-room-title">선택한 객실: {selected.name}</p>
            <p>
              {request.checkInDate} ~ {request.checkOutDate} · {request.guestCount}명
            </p>
            {onLoginRequired ? (
              <>
                <BookingSummary room={selected} request={request} />
                <p>
                  객실과 요금은 로그인 없이 확인할 수 있습니다. 예약자 정보 입력은 로그인 후
                  진행합니다.
                </p>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() =>
                    onLoginRequired({ stay: request, roomId: selected.roomId, roomPage: page })
                  }
                >
                  예약하려면 로그인
                </button>
              </>
            ) : (
              <BookingFlow
                onComplete={onComplete}
                selection={{
                  accommodation: { accommodationId, name: accommodationName },
                  room: selected,
                  stay: request,
                }}
              />
            )}
            <button type="button" onClick={() => setSelectedId(null)}>
              객실 선택 해제
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
