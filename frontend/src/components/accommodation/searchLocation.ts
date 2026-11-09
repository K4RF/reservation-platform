import type { AccommodationSearchRequest } from '../../api/accommodation'
import type { LocationSuggestion } from '../../api/locationSuggestions'

export type DestinationDraft =
  | { kind: 'unchanged' | 'text'; text: string }
  | { kind: 'selected'; suggestion: LocationSuggestion }

export function destinationDraft(query: AccommodationSearchRequest): DestinationDraft {
  return {
    kind: 'unchanged',
    text: query.destination ?? (query.country ? (query.region ?? query.city) : query.city) ?? '',
  }
}

export function destinationInputValue(draft: DestinationDraft): string {
  return draft.kind === 'selected' ? draft.suggestion.displayName : draft.text
}

export function applyDestination(
  query: AccommodationSearchRequest,
  draft: DestinationDraft,
): AccommodationSearchRequest {
  if (draft.kind === 'unchanged') return query
  if (draft.kind === 'selected') {
    const { country, city, region, status } = draft.suggestion.searchParams
    return { ...query, destination: undefined, country, city, region, status }
  }
  return {
    ...query,
    country: undefined,
    city: undefined,
    region: undefined,
    destination: draft.text,
  }
}

export function searchLocationLabel(query: AccommodationSearchRequest): string {
  return (
    query.destination ??
    ([query.country, query.city, query.region].filter(Boolean).join(' · ') || '전체 지역')
  )
}
