import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AccommodationList } from './AccommodationList'
import { toAccommodationCard } from './accommodationView'
import { accommodation } from '../../test/accommodation'

describe('AccommodationList', () => {
  it('maps verified fields into cards and links to the detail route without invented images/prices', () => {
    render(
      <MemoryRouter>
        <AccommodationList accommodations={[toAccommodationCard(accommodation)]} />
      </MemoryRouter>,
    )
    const detail = new URL(
      screen.getByRole('link', { name: '서울 호텔' }).getAttribute('href')!,
      'http://localhost',
    )
    expect(detail.pathname).toBe('/accommodations/7')
    expect(new URLSearchParams(detail.searchParams.get('search')!).get('page')).toBe('0')
    expect(screen.getByText('대한민국 서울특별시 강남구 테헤란로 1')).toBeTruthy()
    expect(screen.getByText('편안한 숙소')).toBeTruthy()
    expect(screen.getByText('주차')).toBeTruthy()
    expect(screen.getByText('운영 중')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('사진 정보 미제공').closest('[aria-hidden="true"]')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.queryByText(/최저가|평점|인기|리뷰|할인/)).toBeNull()
    expect(
      screen
        .getByText('사진 정보 미제공')
        .closest('article')
        ?.querySelector('svg')
        ?.getAttribute('aria-hidden'),
    ).toBe('true')
  })
  it('uses only the legacy address when structured location is null', () => {
    expect(
      toAccommodationCard({ ...accommodation, country: null, city: null, region: null }).location,
    ).toBe('테헤란로 1')
    expect(toAccommodationCard({ ...accommodation, status: 'INACTIVE' }).status).toBe('운영 중지')
  })
  it('renders an accessible empty result', () => {
    render(<AccommodationList accommodations={[]} />)
    expect(screen.getByRole('status').textContent).toContain('검색 조건에 맞는 숙소가 없습니다.')
  })
})
