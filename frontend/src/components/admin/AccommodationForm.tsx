import { useState } from 'react'
import { accommodationAmenities } from '../../api/accommodation'
import type { AccommodationResponse } from '../../api/accommodation'
import type { AccommodationWriteRequest } from '../../api/adminAccommodation'
import { amenityLabels } from '../accommodation/accommodationView'
import { ErrorState } from '../ui/ErrorState'

import {
  accommodationTextFields as textFields,
  validateAccommodation,
} from './accommodationValidation'

export function AccommodationForm({
  initial,
  disabled,
  onSave,
}: {
  initial?: AccommodationResponse
  disabled: boolean
  onSave: (body: AccommodationWriteRequest) => void
}) {
  const [body, setBody] = useState<AccommodationWriteRequest>(() => ({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    country: initial?.country ?? '',
    city: initial?.city ?? '',
    region: initial?.region ?? '',
    address: initial?.address ?? '',
    amenities: initial?.amenities ?? [],
    checkInTime: initial?.checkInTime ?? '',
    checkOutTime: initial?.checkOutTime ?? '',
    timeZone: initial?.timeZone ?? '',
  }))
  const [errors, setErrors] = useState<string[]>([])
  return (
    <form
      aria-label={initial ? '숙소 정보 수정' : '숙소 생성'}
      className="admin-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        const next = { ...body }
        for (const [field] of textFields) next[field] = next[field].trim()
        const problems = validateAccommodation(next)
        setErrors(problems)
        if (!problems.length) onSave(next)
      }}
    >
      <fieldset disabled={disabled}>
        <legend>{initial ? '숙소 정보 수정' : '새 숙소 생성 (ACTIVE)'}</legend>
        {initial && (
          <p>
            미등록 위치·운영시간은 빈칸으로 표시합니다. 추측하지 말고 확인한 값을 모두 입력하세요.
          </p>
        )}
        {textFields.map(([field, label, max]) => (
          <div className="form-field" key={field}>
            <label htmlFor={`accommodation-${field}`}>{label}</label>
            {field === 'description' ? (
              <textarea
                id={`accommodation-${field}`}
                name={field}
                required
                maxLength={max}
                value={body[field]}
                onChange={(event) => setBody({ ...body, [field]: event.target.value })}
              />
            ) : (
              <input
                id={`accommodation-${field}`}
                name={field}
                required
                maxLength={max}
                value={body[field]}
                placeholder={field === 'timeZone' ? '예: Asia/Seoul' : undefined}
                onChange={(event) => setBody({ ...body, [field]: event.target.value })}
              />
            )}
          </div>
        ))}
        <fieldset>
          <legend>숙소 편의시설</legend>
          {accommodationAmenities.map((amenity) => (
            <label className="admin-check" key={amenity}>
              <input
                type="checkbox"
                name="amenities"
                value={amenity}
                checked={body.amenities.includes(amenity)}
                onChange={(event) =>
                  setBody({
                    ...body,
                    amenities: event.target.checked
                      ? [...body.amenities, amenity]
                      : body.amenities.filter((value) => value !== amenity),
                  })
                }
              />
              {amenityLabels[amenity]}
            </label>
          ))}
        </fieldset>
        {(['checkInTime', 'checkOutTime'] as const).map((field, index) => (
          <div className="form-field" key={field}>
            <label htmlFor={`accommodation-${field}`}>
              {index === 0 ? '체크인 시간' : '체크아웃 시간'}
            </label>
            <input
              id={`accommodation-${field}`}
              type="time"
              step="any"
              name={field}
              required
              value={body[field]}
              onChange={(event) => setBody({ ...body, [field]: event.target.value })}
            />
          </div>
        ))}
        {errors.length > 0 && <ErrorState message={errors.join(' ')} />}
        <button type="submit">{initial ? '숙소 정보 저장' : '숙소 생성'}</button>
      </fieldset>
    </form>
  )
}
