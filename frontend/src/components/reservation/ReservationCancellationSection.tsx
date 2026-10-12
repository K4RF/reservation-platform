import { useCallback, useState } from 'react'
import { ApiError } from '../../api/errors'
import {
  getReservationCancellationSummary,
  type ReservationCancellationSummary as CancellationSummary,
} from '../../api/reservationCancellation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { reservationReadError } from './reservationView'
import { ReservationCancellationSummary } from './ReservationCancellationSummary'

export function ReservationCancellationSection({
  reservation,
  onRefresh,
}: {
  reservation: CancellationSummary
  onRefresh?: () => void
}) {
  if (reservation.status !== 'CONFIRMED') return null
  return (
    <CancellationPreparation
      key={JSON.stringify(reservation)}
      reservationId={reservation.reservationId}
      onRefresh={onRefresh}
    />
  )
}

function CancellationPreparation({
  reservationId,
  onRefresh,
}: {
  reservationId: number
  onRefresh?: () => void
}) {
  const [open, setOpen] = useState(false)
  const id = `reservation-${reservationId}-cancellation-preparation`
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        취소 정책 및 수수료 확인
      </button>
      {open && (
        <CancellationConfirmation reservationId={reservationId} id={id} onRefresh={onRefresh} />
      )}
    </>
  )
}

function CancellationConfirmation({
  reservationId,
  id,
  onRefresh,
}: {
  reservationId: number
  id: string
  onRefresh?: () => void
}) {
  const load = useCallback(
    (signal: AbortSignal) => getReservationCancellationSummary(reservationId, signal),
    [reservationId],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>취소 전 확인</h3>
      {state.status === 'loading' && (
        <LoadingState message="저장된 취소 정책과 예약 상태를 다시 조회하고 있습니다." />
      )}
      {state.status === 'error' && (
        <ErrorState message={cancellationReadError(state.error)} onRetry={retry} />
      )}
      {state.status === 'success' && (
        <CancellationReview
          key={JSON.stringify(state.data)}
          reservation={state.data}
          onRefresh={onRefresh}
        />
      )}
    </section>
  )
}

function CancellationReview({
  reservation,
  onRefresh,
}: {
  reservation: CancellationSummary
  onRefresh?: () => void
}) {
  const [acknowledged, setAcknowledged] = useState(false)
  return (
    <>
      <ReservationCancellationSummary reservation={reservation} />
      {reservation.status === 'CONFIRMED' && (
        <>
          <label>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            저장된 정책과 사전 금액 미제공 안내를 확인했습니다.
          </label>
          <p role="status">
            {acknowledged
              ? '안내를 확인했습니다. 아직 취소 요청은 전송되지 않았습니다.'
              : '취소 전에 저장된 정책과 금액 미제공 안내를 확인하세요.'}
          </p>
          <button type="button" disabled>
            예약 취소 실행 (준비 중)
          </button>
          <p>취소 실행은 아직 제공되지 않습니다. 이 화면은 예약이나 재고를 변경하지 않습니다.</p>
        </>
      )}
      {onRefresh && (
        <button type="button" onClick={onRefresh}>
          예약 상세 다시 조회
        </button>
      )}
    </>
  )
}

function cancellationReadError(error: unknown) {
  const message = reservationReadError(error)
  return error instanceof ApiError && error.kind === 'http' && error.code
    ? `${message} [${error.code}] ${error.message}${error.fieldErrors.map((field) => ` ${field.field}: ${field.message}`).join('')}`
    : message
}
