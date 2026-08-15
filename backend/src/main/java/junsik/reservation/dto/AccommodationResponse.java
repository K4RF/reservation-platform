package junsik.reservation.dto;

import junsik.reservation.entity.Accommodation;

public record AccommodationResponse(
		Long accommodationId,
		String name,
		String description,
		String address
) {

	public static AccommodationResponse from(Accommodation accommodation) {
		return new AccommodationResponse(
				accommodation.getId(),
				accommodation.getName(),
				accommodation.getDescription(),
				accommodation.getAddress()
		);
	}
}
