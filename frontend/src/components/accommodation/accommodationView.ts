import type { AccommodationAmenity, AccommodationResponse } from '../../api/accommodation'

export const amenityLabels: Record<AccommodationAmenity, string> = {
  PARKING: '주차',
  BREAKFAST: '조식',
  POOL: '수영장',
  GYM: '피트니스',
  PET_FRIENDLY: '반려동물 동반',
}

export function toAccommodationCard(response: AccommodationResponse) {
  return {
    id: response.accommodationId,
    name: response.name,
    description: response.description,
    location: [response.country, response.city, response.region, response.address]
      .filter((value) => value?.trim())
      .join(' '),
    amenities: response.amenities.map((amenity) => amenityLabels[amenity]),
    status: response.status === 'ACTIVE' ? '운영 중' : '운영 중지',
  }
}

export type AccommodationCardModel = ReturnType<typeof toAccommodationCard>
