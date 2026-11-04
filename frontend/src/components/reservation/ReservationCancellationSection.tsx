import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/errors'
import {
  getReservationCancellationSummary,
  type ReservationCancellationSummary as CancellationSummary,
  type ReservationCancellationResponse,
} from '../../api/reservationCancellation'
import { useDetailQuery } from '../../pages/useDetailQuery'
import { ErrorState } from '../ui/ErrorState'
import { LoadingState } from '../ui/LoadingState'
import { reservationReadError } from './reservationView'
import { ReservationCancellationSummary } from './ReservationCancellationSummary'
import { ReservationCancellationSubmit } from './ReservationCancellationSubmit'

interface CancellationActions {
  onRefresh?: () => void
  onCancelled?: (result: ReservationCancellationResponse) => void
  onLock?: (locked: boolean) => void
}
interface PreparationState {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ReservationCancellationSection({
  reservation,
  onRefresh,
  onCancelled,
  onLock,
  open,
  onOpenChange,
}: {
  reservation: CancellationSummary
} & CancellationActions &
  PreparationState) {
  if (reservation.status !== 'CONFIRMED') return null
  return (
    <CancellationPreparation
      key={JSON.stringify(reservation)}
      reservationId={reservation.reservationId}
      onRefresh={onRefresh}
      onCancelled={onCancelled}
      onLock={onLock}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

function CancellationPreparation({
  reservationId,
  onRefresh,
  onCancelled,
  onLock,
  open: controlledOpen,
  onOpenChange,
}: {
  reservationId: number
} & CancellationActions &
  PreparationState) {
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
  const id = `reservation-${reservationId}-cancellation-preparation`
  return (
    <>
      <button
        ref={trigger}
        type="button"
        disabled={locked}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => toggle(!open)}
      >
        취소 정책 및 수수료 확인
      </button>
      {open && (
        <CancellationConfirmation
          reservationId={reservationId}
          id={id}
          onRefresh={onRefresh}
          onCancelled={onCancelled}
          onClose={() => toggle(false)}
          onLock={(value) => {
            setLocked(value)
            onLock?.(value)
          }}
        />
      )}
    </>
  )
}

function CancellationConfirmation({
  reservationId,
  id,
  onRefresh,
  onCancelled,
  onLock,
  onClose,
}: {
  reservationId: number
  id: string
  onClose: () => void
} & CancellationActions) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const load = useCallback(
    (signal: AbortSignal) => getReservationCancellationSummary(reservationId, signal),
    [reservationId],
  )
  const { state, retry } = useDetailQuery(load)
  return (
    <section
      className="confirmation-panel reservation-cancel-confirmation"
      id={id}
      aria-labelledby={`${id}-heading`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <h3 id={`${id}-heading`} ref={heading} tabIndex={-1}>
        취소 전 확인
      </h3>
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
          onCancelled={onCancelled}
          onLock={onLock}
        />
      )}
    </section>
  )
}

function CancellationReview({
  reservation,
  onRefresh,
  onCancelled,
  onLock,
}: {
  reservation: CancellationSummary
} & CancellationActions) {
  return (
    <>
      <ReservationCancellationSummary reservation={reservation} />
      {reservation.status === 'CONFIRMED' && (
        <ReservationCancellationSubmit
          reservationId={reservation.reservationId}
          onLock={(value) => onLock?.(value)}
          onRefresh={onRefresh}
          onCancelled={onCancelled}
        />
      )}
      {onRefresh && reservation.status === 'CANCELLED' && (
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
