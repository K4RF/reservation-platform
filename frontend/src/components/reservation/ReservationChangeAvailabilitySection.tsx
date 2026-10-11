import { useCallback, useState } from 'react'
import type { ReservationDetail } from '../../api/reservationDetail'
import { getReservationChangeAvailability } from '../../api/reservationChangeAvailability'
import { ApiError } from '../../api/errors'
import type { AvailabilityRequest } from '../../api/availabilityValidation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { useAvailabilityForm } from '../room/useAvailabilityForm'
import { StayDateFields } from '../room/StayDateFields'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'

type ChangeReservation = Pick<
  ReservationDetail,
  'reservationId' | 'roomId' | 'guestCount' | 'checkInDate' | 'checkOutDate' | 'status'
>

export function ReservationChangeAvailabilitySection({
  reservation,
  accommodationId,
}: {
  reservation: ChangeReservation
  accommodationId: number | null
}) {
  if (reservation.status !== 'CONFIRMED') return null
  return (
    <ChangePreparation
      key={`${reservation.reservationId}:${accommodationId}:${reservation.roomId}:${reservation.guestCount}:${reservation.checkInDate}:${reservation.checkOutDate}`}
      reservation={reservation}
      accommodationId={accommodationId}
    />
  )
}

function ChangePreparation({
  reservation,
  accommodationId,
}: {
  reservation: ChangeReservation
  accommodationId: number | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        disabled={accommodationId === null}
        aria-expanded={open}
        aria-controls="reservation-change-preparation"
        onClick={() => setOpen((value) => !value)}
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
        <ChangeDates reservation={reservation} accommodationId={accommodationId} />
      )}
    </>
  )
}

function ChangeDates({
  reservation,
  accommodationId,
}: {
  reservation: ChangeReservation
  accommodationId: number
}) {
  const { draft, request, error, revision, change, submit } = useAvailabilityForm(
    {
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      guestCount: reservation.guestCount,
    },
    false,
  )
  return (
    <section id="reservation-change-preparation" aria-labelledby="reservation-change-heading">
      <h3 id="reservation-change-heading">새 일정의 일반 가용성 조회</h3>
      <p>
        현재 예약 일정: {reservation.checkInDate} ~ {reservation.checkOutDate}
      </p>
      <p>
        객실 ID: {reservation.roomId} · 인원: {reservation.guestCount}명 (변경하지 않음)
      </p>
      <p>
        일반 신규 예약 기준의 참고 정보입니다. 기존 예약 점유는 제외되지 않으며, 현재 객실이 목록에
        없어도 일정 변경 불가를 의미하지 않습니다.
      </p>
      <form
        className="accommodation-search-form"
        aria-label="예약 변경 날짜 조건"
        onSubmit={submit}
      >
        <StayDateFields
          prefix="reservation-change"
          labelPrefix="새"
          draft={draft}
          onChange={change}
        />
        <button type="submit">변경 날짜 가용성 조회</button>
      </form>
      {error && <ErrorState message={error} />}
      {!request && !error && (
        <p>새 날짜를 확인한 후 가용성을 조회하세요. 아직 예약은 변경되지 않았습니다.</p>
      )}
      {request && (
        <ChangeAvailabilityResults
          key={revision}
          accommodationId={accommodationId}
          roomId={reservation.roomId}
          request={request}
        />
      )}
      <p>
        일정 변경 실행은 후속 작업입니다. 최종 변경 가능 여부·재고·예약 정책·변경 금액은 서버의 예약
        일정 변경 API가 검증합니다.
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
    <div className={state.data === 'not_listed' ? 'empty-state' : undefined}>
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
