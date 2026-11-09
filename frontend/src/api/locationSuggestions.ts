import { apiClient } from './client'
import { ApiError } from './errors'

export const locationQueryMaxLength = 100

export function normalizeDestinationText(text: string): string {
  return text.replace(/\p{White_Space}+/gu, ' ').trim()
}

type LocationSearchParams = { country: string; city: string; status: 'ACTIVE' }
export type LocationSuggestion =
  | { type: 'CITY'; displayName: string; searchParams: LocationSearchParams & { region?: never } }
  | { type: 'REGION'; displayName: string; searchParams: LocationSearchParams & { region: string } }

export function normalizeLocationQuery(text: string): string | null {
  if (text.length > locationQueryMaxLength) return null
  const query = normalizeDestinationText(text)
  return [...query].length >= 2 ? query : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isLocationName(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= locationQueryMaxLength
  )
}

function isSuggestion(value: unknown): value is LocationSuggestion {
  if (!isRecord(value) || !isRecord(value.searchParams) || !isLocationName(value.displayName))
    return false
  const { country, city, region, status } = value.searchParams
  if (!isLocationName(country) || !isLocationName(city) || status !== 'ACTIVE') return false
  return value.type === 'CITY'
    ? region === undefined && value.displayName === city
    : value.type === 'REGION' && isLocationName(region) && value.displayName === region
}

export async function getLocationSuggestions(
  query: string,
  signal: AbortSignal,
): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ q: query })
  const response = await apiClient.request<unknown>(
    `/accommodations/locations/suggestions?${params}`,
    {
      includeAuth: false,
      signal,
    },
  )
  if (!Array.isArray(response) || response.length > 10 || !response.every(isSuggestion)) {
    throw new ApiError('지역 후보 응답이 올바르지 않습니다.', { kind: 'unexpected_response' })
  }
  return response
}
