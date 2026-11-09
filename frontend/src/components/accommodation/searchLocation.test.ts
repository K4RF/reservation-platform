import { describe, expect, it } from 'vitest'
import { gangnam, seoul } from '../../test/locationSuggestions'
import { applyDestination, destinationDraft, destinationInputValue } from './searchLocation'

describe('location draft projection', () => {
  it('replaces a selected district with a city without carrying forward the former district', () => {
    const query = { ...gangnam.searchParams, guestCount: 2 }
    expect(destinationInputValue(destinationDraft(query))).toBe('강남구')
    expect(applyDestination(query, { kind: 'selected', suggestion: seoul })).toMatchObject({
      ...seoul.searchParams,
      region: undefined,
      destination: undefined,
      guestCount: 2,
    })
  })

  it('does not reinterpret an unchanged old city/region link or carry a tuple into an edit', () => {
    const legacy = { city: '서울특별시', region: '강남구' }
    expect(applyDestination(legacy, destinationDraft(legacy))).toBe(legacy)
    expect(applyDestination(gangnam.searchParams, { kind: 'text', text: '강남구' })).toMatchObject({
      destination: '강남구',
      country: undefined,
      city: undefined,
      region: undefined,
    })
  })
})
