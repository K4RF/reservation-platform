import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { getAvailableRooms } from '../../api/room'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import { useAvailabilityForm } from './useAvailabilityForm'
import { CompactSearchBar } from './CompactSearchBar'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { EmptyState } from '../ui/EmptyState'
import { RoomCard } from './RoomCard'
import { BookingFlow } from '../booking/BookingFlow'
import {
  BookingSummary,
  BookingPriceSession,
  type BookingPriceQuery,
} from '../booking/BookingSummary'
import type { MediaResponse } from '../../api/media'
import { RoomExplorationLayout } from './RoomExplorationLayout'
import type { BookingContext } from '../../app/bookingContext'

interface AvailabilityProps {
  accommodationId: number
  accommodationName?: string
  onComplete?: (id: number) => void
  initialContext?: BookingContext | null
  onLoginRequired?: (context: BookingContext) => void
  introduction?: ReactNode
  information?: ReactNode
  catalog?: ReactNode
  accommodationActive?: boolean
  accommodationImage?: MediaResponse | null
  onBookingStageChange?: (active: boolean) => void
}

export function RoomAvailabilitySection(props: AvailabilityProps) {
  return <AvailabilityForm key={props.accommodationId} {...props} />
}

function AvailabilityForm(props: AvailabilityProps) {
  const { draft, request, error, revision, change, submit } = useAvailabilityForm(
    props.initialContext?.stay ?? null,
  )
  const errorFocus = useRef<HTMLDivElement>(null)
  const controlsRoot = useRef<HTMLDivElement>(null)
  const restoreEditor = useRef<string | null>(null)
  function edit(field: keyof typeof draft, value: string) {
    if (request)
      restoreEditor.current = field === 'guestCount' ? '숙박 인원 선택' : '숙박 날짜 선택'
    change(field, value)
  }
  useEffect(() => {
    // Switching from available results to catalog remounts the presentation, not its draft owner.
    if (!request && restoreEditor.current) {
      controlsRoot.current
        ?.querySelector<HTMLButtonElement>(`button[aria-label="${restoreEditor.current}"]`)
        ?.focus({ preventScroll: true })
      restoreEditor.current = null
    }
  }, [request])
  useEffect(() => {
    if (error) {
      errorFocus.current?.focus()
      errorFocus.current?.scrollIntoView?.({ block: 'center' })
    }
  }, [error, revision])
  const controls = (
    <div className="detail-stay-controls" ref={controlsRoot}>
      <h2 id="availability-title" tabIndex={-1}>
        머무를 시간을 선택하세요.
      </h2>
      <form className="accommodation-search-form" onSubmit={submit} aria-label="객실 가용성 조건">
        <CompactSearchBar
          prefix="availability"
          dates={draft}
          onDateChange={edit}
          guestCount={draft.guestCount}
          onGuestChange={(value) => edit('guestCount', value)}
          actionLabel="예약 가능 객실 조회"
        />
      </form>
      {error && (
        <div ref={errorFocus} tabIndex={-1}>
          <ErrorState message={error} />
        </div>
      )}
      {props.accommodationActive === false && (
        <p role="status">운영 중지 숙소입니다. 객실은 둘러볼 수 있지만 예약할 수 없습니다.</p>
      )}
    </div>
  )
  if (!request || props.accommodationActive === false)
    return (
      <RoomExplorationLayout
        introduction={props.introduction}
        information={props.information}
        controls={controls}
        rooms={props.catalog}
      />
    )
  return (
    <AvailabilityResults
      key={`${revision}:${Boolean(props.onLoginRequired)}`}
      focusResults={revision > 0}
      {...props}
      controls={controls}
      request={request}
      initialContext={revision === 0 ? props.initialContext : null}
    />
  )
}

function AvailabilityResults({
  accommodationId,
  accommodationName,
  onComplete,
  request,
  initialContext,
  onLoginRequired,
  introduction,
  information,
  controls,
  focusResults,
  accommodationImage,
  onBookingStageChange,
}: AvailabilityProps & {
  request: AvailabilityRequest
  controls: ReactNode
  focusResults: boolean
}) {
  const [page, setPage] = useState(initialContext?.roomPage ?? 0)
  const [selectedId, setSelectedId] = useState<number | null>(initialContext?.roomId ?? null)
  const [bookingStarted, setBookingStarted] = useState(false)
  const load = useCallback(
    (signal: AbortSignal) => getAvailableRooms(accommodationId, request, page, signal),
    [accommodationId, request, page],
  )
  const { state, retry } = useDetailQuery(load)
  useEffect(() => {
    if (focusResults && state.status === 'success')
      document.getElementById('room-list-title')?.focus()
  }, [focusResults, state.status])
  function choose(id: number | null) {
    setBookingStarted(false)
    setSelectedId(id)
  }
  function move(next: number) {
    choose(null)
    setPage(next)
  }
  // URL selection is only a hint; getAvailableRooms validates IDs, ACTIVE and capacity.
  const selected =
    state.status === 'success'
      ? state.data.content.find((room) => room.roomId === selectedId)
      : undefined
  const bookingActive = bookingStarted && !!selected && !onLoginRequired
  useEffect(() => {
    onBookingStageChange?.(bookingActive)
    return () => onBookingStageChange?.(false)
  }, [bookingActive, onBookingStageChange])
  function proceed() {
    if (!selected) return
    if (onLoginRequired) onLoginRequired({ stay: request, roomId: selected.roomId, roomPage: page })
    else setBookingStarted(true)
  }
  const rooms = (
    <section className="availability-room-results" aria-labelledby="room-list-title">
      <h2 id="room-list-title" tabIndex={-1}>
        당신에게 맞는 객실
      </h2>
      <p>
        {request.checkInDate} → {request.checkOutDate} · 총 {request.guestCount}명
      </p>
      {state.status === 'loading' && (
        <LoadingState message="예약 가능한 객실을 확인하고 있습니다." />
      )}
      {state.status === 'error' && (
        <ErrorState
          message="가용성을 확인하지 못했습니다. 날짜·인원·숙소 예약 조건을 확인하고 다시 시도하세요."
          onRetry={() => {
            choose(null)
            retry()
          }}
        />
      )}
      {state.status === 'success' && (
        <>
          {!state.data.content.length ? (
            <EmptyState message="선택한 조건에 예약 가능한 객실이 없습니다.">
              <p>다른 날짜나 인원으로 다시 조회해 보세요.</p>
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
                      fallbackId: 'room-list-title',
                      request,
                      onSelect: (chosen) => choose(chosen.roomId),
                    }}
                  />
                  <div className="room-card-selection">
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
                      aria-label={`${room.name} 선택`}
                      aria-pressed={selected?.roomId === room.roomId}
                      onClick={() => choose(room.roomId)}
                    >
                      선택
                    </button>
                  </div>
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
        </>
      )}
    </section>
  )
  function renderLayout(price?: BookingPriceQuery) {
    const summary = selected && (
      <div className="selected-room" role="status" aria-label="선택한 객실">
        <p className="selected-room-title">선택한 객실: {selected.name}</p>
        <BookingSummary room={selected} request={request} compact price={price} />
        <p className="selection-panel-notice">
          선택은 예약 확정이 아닙니다. 최종 금액과 가용성은 예약 시 다시 확인합니다.
        </p>
        {bookingStarted ? (
          <a href="#booking-stage-title">예약 입력으로 이동</a>
        ) : (
          <button className="primary-action" type="button" onClick={proceed}>
            {onLoginRequired ? '예약하려면 로그인' : '예약 정보 입력'}
          </button>
        )}
        <button type="button" onClick={() => choose(null)}>
          객실 선택 해제
        </button>
      </div>
    )
    return (
      <RoomExplorationLayout
        introduction={introduction}
        information={information}
        controls={controls}
        rooms={rooms}
        hasAppliedStay
        summary={summary}
        selectedName={selected?.name}
        onContinue={selected && !bookingStarted ? proceed : undefined}
        booking={
          bookingActive &&
          selected && (
            <section className="detail-booking-stage" aria-labelledby="booking-stage-title">
              <BookingFlow
                price={price}
                onReturn={() => {
                  setBookingStarted(false)
                  requestAnimationFrame(() =>
                    document.getElementById('room-selection-panel-title')?.focus(),
                  )
                }}
                onComplete={onComplete}
                selection={{
                  accommodation: {
                    accommodationId,
                    name: accommodationName,
                    representativeImage: accommodationImage,
                  },
                  room: selected,
                  stay: request,
                }}
              />
            </section>
          )
        }
      />
    )
  }
  return selected ? (
    <BookingPriceSession key={selected.roomId} room={selected} request={request}>
      {renderLayout}
    </BookingPriceSession>
  ) : (
    renderLayout()
  )
}
