import { useState } from 'react'
import type { RoomDailyPriceResponse } from '../../api/bookingPrice'
import { readRoomPrice } from './roomValidation'
import { ErrorState } from '../ui/ErrorState'

export function DailyPriceForm({
  price,
  disabled,
  onSave,
}: {
  price: RoomDailyPriceResponse
  disabled: boolean
  onSave: (nightlyPrice: number) => void
}) {
  const creating = price.source === 'DEFAULT'
  const [amount, setAmount] = useState(creating ? '' : String(price.nightlyPrice))
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      className="admin-form"
      aria-label="날짜별 가격 입력"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        const nightlyPrice = readRoomPrice(amount)
        if (nightlyPrice === null) {
          setError(
            '가격은 0보다 크고 정수 10자리·소수 2자리 이하여야 합니다. 반올림하지 않고 다시 입력해 주세요.',
          )
          return
        }
        if (!confirmed) {
          setError('객실·숙박 날짜·가격과 생성/수정 작업을 확인해 주세요.')
          return
        }
        setError('')
        setConfirmed(false)
        onSave(nightlyPrice)
      }}
    >
      <fieldset disabled={disabled}>
        <legend>{creating ? '날짜별 가격 생성 (POST)' : '기존 날짜별 가격 수정 (PUT)'}</legend>
        <p>
          대상 객실 ID {price.roomId} · 숙박 날짜 {price.stayDate}
        </p>
        <p>
          직전 GET의 출처를 기준으로 {creating ? '생성' : '수정'}합니다. 다른 관리자의 변경으로
          충돌하면 먼저 다시 조회하세요. 요청은 자동 전환하거나 재전송하지 않습니다.
        </p>
        <div className="form-field">
          <label htmlFor="admin-daily-price-amount">설정할 날짜별 1박 가격</label>
          <input
            id="admin-daily-price-amount"
            name="nightlyPrice"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value)
              setConfirmed(false)
            }}
          />
        </div>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          객실·숙박 날짜·가격과 생성/수정 작업을 확인했습니다.
        </label>
        {error && <ErrorState message={error} />}
        <button type="submit" disabled={!confirmed}>
          {creating ? '날짜별 가격 생성' : '날짜별 가격 저장'}
        </button>
      </fieldset>
    </form>
  )
}
