import type { LocationSuggestion } from '../api/locationSuggestions'

export const seoul = {
  type: 'CITY',
  displayName: '서울특별시',
  searchParams: { country: '대한민국', city: '서울특별시', status: 'ACTIVE' },
} satisfies LocationSuggestion

export const gangnam = {
  type: 'REGION',
  displayName: '강남구',
  searchParams: { ...seoul.searchParams, region: '강남구' },
} satisfies LocationSuggestion
