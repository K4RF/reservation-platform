import { useCallback, useState, type FormEvent } from 'react'
import { getAvailableRooms } from '../../api/room'
import { validateAvailability, type AvailabilityRequest } from '../../api/availabilityValidation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
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
  const [draft, setDraft] = useState({
    checkInDate: initialContext?.stay.checkInDate ?? '',
    checkOutDate: initialContext?.stay.checkOutDate ?? '',
    guestCount: String(initialContext?.stay.guestCount ?? 1),
  })
  const [request, setRequest] = useState<AvailabilityRequest | null>(initialContext?.stay ?? null)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  function change(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setRequest(null)
    setError('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = { ...draft, guestCount: Number(draft.guestCount) }
    const message = validateAvailability(next)
    setError(message ?? '')
    setRequest(message ? null : next)
    setRevision((value) => value + 1)
  }
  return (
    <section aria-labelledby="availability-title">
      <h2 id="availability-title">예약 가능한 객실 조회</h2>
      <p>조회 시점의 가용성입니다. 최종 예약 시 Backend가 재고와 가격을 다시 검증합니다.</p>
      <form className="accommodation-search-form" onSubmit={submit} aria-label="객실 가용성 조건">
        {(['checkInDate', 'checkOutDate'] as const).map((field, index) => (
          <div className="form-field" key={field}>
            <label htmlFor={`availability-${field}`}>
              {['숙박 체크인', '숙박 체크아웃'][index]}
            </label>
            <input
              id={`availability-${field}`}
              type="date"
              required
              value={draft[field]}
              onChange={(event) => change(field, event.target.value)}
            />
          </div>
        ))}
        <div className="form-field">
          <label htmlFor="availability-guests">숙박 인원</label>
          <input
            id="availability-guests"
            type="number"
            min="1"
            max="2147483647"
            step="1"
            required
            value={draft.guestCount}
            onChange={(event) => change('guestCount', event.target.value)}
          />
        </div>
        <button type="submit">예약 가능 객실 조회</button>
      </form>
      {error && <ErrorState message={error} />}
      {!request && !error && <p>날짜와 인원을 입력한 후 조회하세요.</p>}
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
    <>
      {!state.data.content.length ? (
        <div className="empty-state">
          <p role="status">선택한 조건에 예약 가능한 객실이 없습니다.</p>
          <p>
            다른 날짜나 인원으로 다시 조회해 보세요. 객실 운영 상태, 날짜별 잔여 재고와 숙소 예약
            정책에 따라 결과가 달라집니다.
          </p>
        </div>
      ) : (
        <ul className="accommodation-list" aria-label="예약 가능한 객실 목록">
          {state.data.content.map((room) => (
            <li className="availability-room-item" key={room.roomId}>
              <RoomCard room={room} />
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
      {selected && (
        <div role="status" aria-label="선택한 객실">
          <p>선택한 객실: {selected.name}</p>
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
    </>
  )
}
