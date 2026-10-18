import { useState } from 'react'
import type { InventorySaleStatus, RoomInventoryResponse } from '../../api/adminInventory'
import { ErrorState } from '../ui/ErrorState'
import { readInventoryQuantity } from './inventoryValidation'

export function InventoryForm({
  roomId,
  date,
  inventory,
  disabled,
  onSave,
}: {
  roomId: number
  date: string
  inventory?: RoomInventoryResponse
  disabled: boolean
  onSave: (totalQuantity: number, saleStatus: InventorySaleStatus) => void
}) {
  const [total, setTotal] = useState(inventory ? String(inventory.totalQuantity) : '')
  const [saleStatus, setSaleStatus] = useState<InventorySaleStatus>(inventory?.saleStatus ?? 'OPEN')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      className="admin-form"
      aria-label="날짜 재고 입력"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        const quantity = readInventoryQuantity(total)
        if (quantity === null) {
          setError('총수량은 0부터 2147483647 사이의 정수로 입력해 주세요.')
          return
        }
        if (inventory && quantity < inventory.reservedQuantity) {
          setError(
            '총수량을 조회된 예약 수량보다 줄일 수 없습니다. 최신 예약 수량은 서버가 검증합니다.',
          )
          return
        }
        if (!confirmed) {
          setError('객실·날짜·총수량·판매 상태와 생성/수정 작업을 확인해 주세요.')
          return
        }
        setError('')
        setConfirmed(false)
        onSave(quantity, saleStatus)
      }}
    >
      <fieldset disabled={disabled}>
        <legend>{inventory ? '기존 날짜 재고 수정 (PUT)' : '미생성 날짜 재고 생성 (POST)'}</legend>
        <p>
          대상 객실 ID {roomId} · 날짜 {date}
        </p>
        <p>
          예약 수량과 가용 수량은 읽기 전용입니다. CLOSED는 신규 판매만 막으며 기존 예약 수량을
          해제하지 않습니다. 가용 수량이 남아 있어도 CLOSED일 수 있습니다.
        </p>
        <div className="form-field">
          <label htmlFor="inventory-total">설정할 총수량</label>
          <input
            id="inventory-total"
            name="totalQuantity"
            inputMode="numeric"
            required
            value={total}
            onChange={(event) => {
              setTotal(event.target.value)
              setConfirmed(false)
            }}
          />
        </div>
        {inventory ? (
          <div className="form-field">
            <label htmlFor="inventory-sale-status">판매 상태</label>
            <select
              id="inventory-sale-status"
              value={saleStatus}
              onChange={(event) => {
                setSaleStatus(event.target.value as InventorySaleStatus)
                setConfirmed(false)
              }}
            >
              <option value="OPEN">OPEN</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>
        ) : (
          <p>생성 시 판매 상태는 OPEN, 예약 수량은 0으로 서버가 설정합니다.</p>
        )}
        <label className="admin-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          객실·날짜·총수량·판매 상태와 생성/수정 작업을 확인했습니다.
        </label>
        {error && <ErrorState message={error} />}
        <button type="submit" disabled={!confirmed}>
          {inventory ? '날짜 재고 저장' : '날짜 재고 생성'}
        </button>
      </fieldset>
    </form>
  )
}
