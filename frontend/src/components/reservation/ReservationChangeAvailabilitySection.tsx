import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReservationDetail } from '../../api/reservationDetail'
import { getReservationChangeAvailability } from '../../api/reservationChangeAvailability'
import { ApiError } from '../../api/errors'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { useAvailabilityForm } from '../room/useAvailabilityForm'
import { StayDateFields } from '../room/StayDateFields'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { ReservationChangeConfirmation } from './ReservationChangeConfirmation'

type ChangeReservation = ReservationDetail
interface PreparationState {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ReservationChangeAvailabilitySection({
  reservation,
  accommodationId,
  onRefresh,
  onLock,
  open,
  onOpenChange,
}: {
  reservation: ChangeReservation
  accommodationId: number | null
  onRefresh?: (changed?: ReservationDetail) => void
  onLock?: (locked: boolean) => void
} & PreparationState) {
  if (reservation.status !== 'CONFIRMED') return null
  return (
    <ChangePreparation
      key={`${reservation.reservationId}:${accommodationId}:${reservation.roomId}:${reservation.guestCount}:${reservation.checkInDate}:${reservation.checkOutDate}`}
      reservation={reservation}
      accommodationId={accommodationId}
      onRefresh={onRefresh}
      onLock={onLock}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

function ChangePreparation({
  reservation,
  accommodationId,
  onRefresh,
  onLock,
  open: controlledOpen,
  onOpenChange,
}: {
  reservation: ChangeReservation
  accommodationId: number | null
  onRefresh?: (changed?: ReservationDetail) => void
  onLock?: (locked: boolean) => void
} & PreparationState) {
  const [localOpen, setOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const [locked, setLocked] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  function toggle(next: boolean) {
    if (locked) return
    if (onOpenChange) onOpenChange(next)
    else setOpen(next)
    if (!next) trigger.current?.focus()
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={accommodationId === null || locked}
        aria-expanded={open}
        aria-controls="reservation-change-preparation"
        onClick={() => toggle(!open)}
      >
        예약 일정 변경 준비
      </button>
      {accommodationId === null && (
        <p>
          현재 객실의 숙소 정보를 조회해야 변경 날짜 가용성을 확인할 수 있습니다. 숙소·객실 정보를
          다시 조회해 주세요.
        </p>
      )}
      {open && accommodationId !== null && (
        <ChangeDates
          reservation={reservation}
          accommodationId={accommodationId}
          locked={locked}
          onLock={(value) => {
            setLocked(value)
            onLock?.(value)
          }}
          onRefresh={onRefresh}
          onClose={() => toggle(false)}
        />
      )}
    </>
  )
}

function ChangeDates({
  reservation,
  accommodationId,
  locked,
  onLock,
  onRefresh,
  onClose,
}: {
  reservation: ChangeReservation
  accommodationId: number
  locked: boolean
  onLock: (locked: boolean) => void
  onRefresh?: (changed?: ReservationDetail) => void
  onClose: () => void
}) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const { draft, request, error, revision, change, submit } = useAvailabilityForm(
    {
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      guestCount: reservation.guestCount,
    },
    false,
  )
  const [reviewRevision, setReviewRevision] = useState<number | null>(null)
  const reviewing = request !== null && reviewRevision === revision
  return (
    <section
      className="reservation-change-preparation"
      id="reservation-change-preparation"
      aria-labelledby="reservation-change-heading"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !locked) {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <h3 id="reservation-change-heading" ref={heading} tabIndex={-1}>
        {reviewing ? '새 일정 검토' : '새 일정 선택'}
      </h3>
      <div hidden={reviewing}>
        <p className="reservation-stay-line">
          현재 예약 일정: {reservation.checkInDate} ~ {reservation.checkOutDate}
        </p>
        <p>동일한 객실 · 총 {reservation.guestCount}명 (변경하지 않음)</p>
        <form
          className="accommodation-search-form"
          aria-label="예약 변경 날짜 조건"
          onSubmit={(event) => {
            if (locked || reviewing) event.preventDefault()
            else submit(event)
          }}
        >
          <fieldset className="reservation-change-fields" disabled={locked}>
            <StayDateFields
              prefix="reservation-change"
              labelPrefix="새"
              draft={draft}
              onChange={change}
            />
            <button type="submit">변경 날짜 가용성 조회</button>
          </fieldset>
        </form>
        {error && <ErrorState message={error} />}
        {!request && !error && (
          <p>새 날짜를 확인한 후 가용성을 조회하세요. 아직 예약은 변경되지 않았습니다.</p>
        )}
        {request && (
          <div key={revision}>
            <ChangeAvailabilityResults
              accommodationId={accommodationId}
              roomId={reservation.roomId}
              request={request}
            />
            <button type="button" onClick={() => setReviewRevision(revision)}>
              일정 변경 내용 확인
            </button>
          </div>
        )}
      </div>
      {reviewing && request && (
        <>
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              if (!locked) {
                setReviewRevision(null)
                heading.current?.focus()
              }
            }}
          >
            변경 날짜 수정
          </button>
          <ReservationChangeConfirmation
            key={revision}
            reservation={reservation}
            request={request}
            onLock={onLock}
            onRefresh={onRefresh}
          />
        </>
      )}
      <p className="reservation-note">
        기존 예약이 차지한 객실은 조회 결과에서 빠질 수 있습니다. 목록에 없어도 변경 불가를 뜻하지
        않으며, 최종 가능 여부와 금액은 변경 시 확인합니다.
      </p>
    </section>
  )
}

function ChangeAvailabilityResults({
  accommodationId,
  roomId,
  request,
}: {
  accommodationId: number
  roomId: number
  request: AvailabilityRequest
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getReservationChangeAvailability(accommodationId, roomId, request, signal),
    [accommodationId, roomId, request],
  )
  const { state, retry } = useDetailQuery(load)
  if (state.status === 'loading')
    return <LoadingState message="새 일정의 일반 가용성을 확인하고 있습니다." />
  if (state.status === 'error')
    return <ErrorState message={availabilityError(state.error)} onRetry={retry} />
  return (
    <div
      className={`reservation-availability-result${state.data === 'not_listed' ? ' empty-state' : ''}`}
    >
      <p>
        조회한 새 일정: {request.checkInDate} ~ {request.checkOutDate} · {request.guestCount}명
      </p>
      <p role="status">
        {state.data === 'listed'
          ? '현재 객실이 일반 신규 예약 가능 목록에 포함되어 있습니다.'
          : '현재 객실이 일반 신규 예약 가능 목록에 없습니다.'}
      </p>
      <p>
        {state.data === 'listed'
          ? '조회 시점의 참고 정보이며 일정 변경 성공을 보장하지 않습니다.'
          : '기존 예약과 공유하는 숙박일의 점유를 유지할 수 있어 이 결과만으로 변경을 차단하지 않습니다. 최종 판단은 예약 일정 변경 API가 수행합니다.'}
      </p>
    </div>
  )
}

function availabilityError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'unexpected_response')
      return '가용성 응답 형식을 확인할 수 없습니다. 다시 조회해 주세요.'
    if (error.kind === 'timeout') return '가용성 조회 시간이 초과되었습니다. 다시 시도해 주세요.'
    const message = {
      bad_request: '새 날짜·인원·숙소 예약 조건을 확인해 주세요.',
      unauthorized: '로그인이 필요합니다. 다시 로그인해 주세요.',
      forbidden: '가용성 조회 권한을 확인해 주세요.',
      not_found: '숙소 또는 객실 정보를 찾을 수 없습니다.',
      conflict: '재고 또는 예약 조건 충돌이 발생했습니다. 다시 조회해 주세요.',
      server_error: '서버에서 가용성을 확인하지 못했습니다. 다시 시도해 주세요.',
      other: '가용성을 확인하지 못했습니다. 다시 시도해 주세요.',
    }[error.category ?? 'other']
    if (error.kind === 'http')
      return `${message}${error.code ? ` [${error.code}] ${error.message}` : ''}`
  }
  return '가용성을 확인하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
}
