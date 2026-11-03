import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AccommodationList } from './AccommodationList'
import { toAccommodationCard } from './accommodationView'
import { accommodation } from '../../test/accommodation'
import { media } from '../../test/media'

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
    expect(screen.getByText('대한민국 · 서울특별시 · 강남구')).toBeTruthy()
    fireEvent.click(screen.getByText('소개·주소 더 보기'))
    expect(screen.getByText('상세 주소 · 테헤란로 1')).toBeTruthy()
    expect(screen.getByText('편안한 숙소')).toBeTruthy()
    expect(screen.getByText('주차')).toBeTruthy()
    expect(screen.queryByText('운영 중')).toBeNull()
    expect(screen.getByRole('link', { name: '서울 호텔 객실 보기' }).getAttribute('href')).toBe(
      detail.pathname + detail.search,
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('숙소 사진 미제공').closest('[aria-hidden="true"]')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.queryByText(/최저가|평점|인기|리뷰|할인/)).toBeNull()
    expect(screen.getByText('숙소 사진 미제공').closest('.catalog-image-empty')).toBeTruthy()
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
  it('offers the complete long description/address and preserves both detail links after Media failure', () => {
    const photo = media()
    const description = '긴 숙소 소개입니다. '.repeat(30)
    render(
      <MemoryRouter>
        <AccommodationList
          accommodations={[
            toAccommodationCard({
              ...accommodation,
              description,
              status: 'INACTIVE',
              representativeImage: photo,
            }),
          ]}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText(description.slice(0, 100) + '…')).toBeTruthy()
    const full = screen.getByText(description.trim())
    expect(full.closest('details')).toHaveProperty('open', false)
    fireEvent.click(screen.getByText('소개·주소 더 보기'))
    expect(full.closest('details')).toHaveProperty('open', true)
    expect(screen.getByText('운영 중지')).toBeTruthy()
    const rooms = screen.getByRole('link', { name: '서울 호텔 객실 보기' })
    const href = rooms.getAttribute('href')
    fireEvent.error(screen.getByRole('img', { name: photo.altText! }))
    expect(screen.getByText('사진을 불러오지 못했습니다.')).toBeTruthy()
    expect(rooms.getAttribute('href')).toBe(href)
    expect(screen.getByRole('link', { name: '서울 호텔' }).getAttribute('href')).toBe(href)
  })
})
