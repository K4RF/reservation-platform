import type { AvailabilityRequest } from '../../api/availabilityValidation'

type DateField = 'checkInDate' | 'checkOutDate'

export function StayDateFields({
  prefix,
  labelPrefix = '숙박',
  draft,
  onChange,
}: {
  prefix: string
  labelPrefix?: string
  draft: Pick<AvailabilityRequest, DateField>
  onChange: (field: DateField, value: string) => void
}) {
  return (
    <>
      {(['checkInDate', 'checkOutDate'] as const).map((field, index) => (
        <div className="form-field" key={field}>
          <label htmlFor={`${prefix}-${field}`}>
            {labelPrefix} {['체크인', '체크아웃'][index]}
          </label>
          <input
            id={`${prefix}-${field}`}
            type="date"
            required
            value={draft[field]}
            onChange={(event) => onChange(field, event.target.value)}
          />
        </div>
      ))}
    </>
  )
}
