import { useCallback, useState, type FormEvent } from 'react'
import { getAvailableRooms, type RoomResponse } from '../../api/room'
import { validateAvailability, type AvailabilityRequest } from '../../api/availabilityValidation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { RoomCard } from './RoomCard'

export function RoomAvailabilitySection({ accommodationId }: { accommodationId: number }) {
  // A keyed inner component also resets state if this component is reused for another accommodation.
  return <AvailabilityForm key={accommodationId} accommodationId={accommodationId} />
}

function AvailabilityForm({ accommodationId }: { accommodationId: number }) {
  const [draft, setDraft] = useState({ checkInDate: '', checkOutDate: '', guestCount: '1' })
  const [request, setRequest] = useState<AvailabilityRequest | null>(null)
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
        <AvailabilityResults key={revision} accommodationId={accommodationId} request={request} />
      )}
    </section>
  )
}

function AvailabilityResults({
  accommodationId,
  request,
}: {
  accommodationId: number
  request: AvailabilityRequest
}) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<RoomResponse | null>(null)
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
          setSelected(null)
          retry()
        }}
      />
    )
  function move(next: number) {
    setSelected(null)
    setPage(next)
  }
  return (
    <>
      {!state.data.content.length ? (
        <p role="status">선택한 조건에 예약 가능한 객실이 없습니다.</p>
      ) : (
        <ul className="accommodation-list" aria-label="예약 가능한 객실 목록">
          {state.data.content.map((room) => (
            <li className="availability-room-item" key={room.roomId}>
              <RoomCard room={room} />
              <button
                type="button"
                aria-pressed={selected?.roomId === room.roomId}
                onClick={() => setSelected(room)}
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
      {selected && (
        <div role="status" aria-label="선택한 객실">
          <p>선택한 객실: {selected.name}</p>
          <p>
            {request.checkInDate} ~ {request.checkOutDate} · {request.guestCount}명
          </p>
          <p>날짜별 가격·숙박 총액은 아직 조회하지 않았습니다. 예약 생성은 후속 작업입니다.</p>
          <button type="button" onClick={() => setSelected(null)}>
            객실 선택 해제
          </button>
        </div>
      )}
    </>
  )
}
