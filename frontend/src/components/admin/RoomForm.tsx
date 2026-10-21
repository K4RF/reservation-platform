import { useState } from 'react'
import { roomAmenities } from '../../api/accommodation'
import type { RoomAmenity } from '../../api/accommodation'
import type { RoomWriteRequest } from '../../api/adminRoom'
import type { RoomResponse } from '../../api/room'
import { ErrorState } from '../ui/ErrorState'
import { readRoomCapacity, readRoomPrice } from './roomValidation'

export function RoomForm({
  initial,
  disabled,
  onSave,
}: {
  initial?: RoomResponse
  disabled: boolean
  onSave: (body: RoomWriteRequest) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [capacity, setCapacity] = useState(initial ? String(initial.capacity) : '')
  const [price, setPrice] = useState(initial ? String(initial.nightlyPrice) : '')
  const [amenities, setAmenities] = useState<RoomAmenity[]>(initial?.amenities ?? [])
  const [error, setError] = useState('')
  return (
    <form
      className="admin-form"
      aria-label={initial ? '객실 정보 수정' : '객실 생성'}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        const count = readRoomCapacity(capacity),
          nightlyPrice = readRoomPrice(price)
        if (!name.trim() || name.trim().length > 100 || count === null || nightlyPrice === null) {
          setError(
            '객실명은 필수·100자 이하, 전체 수용 인원은 1~2147483647 정수, 기본 1박 가격은 0 초과·정수 10자리/소수 2자리 이하로 입력해 주세요.',
          )
          return
        }
        setError('')
        onSave({ name: name.trim(), capacity: count, nightlyPrice, amenities })
      }}
    >
      <fieldset className="admin-fields-grid" disabled={disabled}>
        <legend>{initial ? '객실 정보 수정' : '새 객실 생성 (ACTIVE)'}</legend>
        <div className="form-field">
          <label htmlFor="admin-room-name">객실 이름</label>
          <input
            id="admin-room-name"
            name="name"
            value={name}
            required
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="admin-room-capacity">전체 수용 인원</label>
          <input
            id="admin-room-capacity"
            name="capacity"
            type="number"
            step="1"
            min="1"
            max="2147483647"
            required
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="admin-room-price">기본 1박 가격</label>
          <input
            id="admin-room-price"
            name="nightlyPrice"
            inputMode="decimal"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
        <p>
          전체 수용 인원은 성인·아동 구분 없는 총 인원입니다. 기본 가격 변경은 날짜별 가격
          Override나 기존 예약 금액을 수정하지 않습니다.
        </p>
        <fieldset>
          <legend>객실 편의시설</legend>
          {roomAmenities.map((amenity) => (
            <label className="admin-check" key={amenity}>
              <input
                name="amenities"
                type="checkbox"
                checked={amenities.includes(amenity)}
                onChange={(event) =>
                  setAmenities(
                    event.target.checked
                      ? [...amenities, amenity]
                      : amenities.filter((value) => value !== amenity),
                  )
                }
              />
              {amenity === 'WIFI' ? '와이파이' : '에어컨'}
            </label>
          ))}
        </fieldset>
        {error && <ErrorState message={error} />}
        <button type="submit">{initial ? '객실 정보 저장' : '객실 생성'}</button>
      </fieldset>
    </form>
  )
}
