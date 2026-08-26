package junsik.reservation.dto;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.enums.AccommodationStatus;

public record AccommodationResponse(
		Long accommodationId,
		String name,
		String description,
		String address,
		AccommodationStatus status
) {

	public static AccommodationResponse from(Accommodation accommodation) {
		return new AccommodationResponse(
				accommodation.getId(),
				accommodation.getName(),
				accommodation.getDescription(),
				accommodation.getAddress(),
				accommodation.getStatus()
		);
	}
}
