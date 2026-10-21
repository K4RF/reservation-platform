import { useState } from 'react'
import type { AccommodationStatus } from '../../api/accommodation'

// Shared presentation/acknowledgement only. Domain URLs and mutation gates stay in the pages.
export function CatalogStatusForm({
  resource,
  currentStatus,
  disabled,
  onSave,
}: {
  resource: 'accommodation' | 'room'
  currentStatus: AccommodationStatus
  disabled: boolean
  onSave: (status: AccommodationStatus) => void
}) {
  const room = resource === 'room'
  const title = room ? '객실 운영 상태 변경' : '운영 상태 변경'
  const label = room ? '변경할 객실 상태' : '변경할 운영 상태'
  const acknowledgement = room ? '객실 상태 변경을 확인했습니다.' : '운영 상태 변경을 확인했습니다.'
  const [status, setStatus] = useState<AccommodationStatus>(
    currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
  )
  const [confirmed, setConfirmed] = useState(false)
  return (
    <form
      className="admin-form admin-status-form"
      aria-label={room ? title : '숙소 운영 상태 변경'}
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled || !confirmed) return
        setConfirmed(false)
        onSave(status)
      }}
    >
      <fieldset disabled={disabled}>
        <legend>{title}</legend>
        <p>
          {room
            ? '운영 중지는 삭제가 아니며 기존 예약 이력과 재고를 임의로 제거하지 않습니다.'
            : '삭제 대신 운영 상태만 변경합니다. 기존 예약을 삭제하지 않습니다.'}
        </p>
        <div className="form-field">
          <label htmlFor={`${resource}-status`}>{label}</label>
          <select
            id={`${resource}-status`}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as AccommodationStatus)
              setConfirmed(false)
            }}
          >
            <option value="ACTIVE">운영 중 (ACTIVE)</option>
            <option value="INACTIVE">운영 중지 (INACTIVE)</option>
          </select>
        </div>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {acknowledgement}
        </label>
        <button type="submit" data-status={status} disabled={!confirmed}>
          {room ? '객실 상태 저장' : '운영 상태 저장'}
        </button>
      </fieldset>
    </form>
  )
}
