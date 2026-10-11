import { useState, type FormEvent } from 'react'
import { validateAvailability, type AvailabilityRequest } from '../../api/availabilityValidation'

// The parent keys the form to its resource/session. Editing invalidates the submitted query.
export function useAvailabilityForm(
  initialStay: AvailabilityRequest | null = null,
  queryInitially = Boolean(initialStay),
) {
  const [draft, setDraft] = useState({
    checkInDate: initialStay?.checkInDate ?? '',
    checkOutDate: initialStay?.checkOutDate ?? '',
    guestCount: String(initialStay?.guestCount ?? 1),
  })
  const [request, setRequest] = useState<AvailabilityRequest | null>(
    queryInitially ? initialStay : null,
  )
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  function change(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
    setRequest(null)
    setError('')
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = { ...draft, guestCount: Number(draft.guestCount) }
    const message = validateAvailability(next)
    setError(message ?? '')
    setRequest(message ? null : next)
    setRevision((value) => value + 1)
  }
  return { draft, request, error, revision, change, submit }
}
