package junsik.reservation.dto.accommodation.response;

import java.time.LocalTime;
import java.util.List;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationStatus;

public record AccommodationResponse(
		Long accommodationId,
		String name,
		String description,
		String country,
		String city,
		String region,
		String address,
		List<AccommodationAmenity> amenities,
		LocalTime checkInTime,
		LocalTime checkOutTime,
		String timeZone,
		AccommodationStatus status
) {

	public static AccommodationResponse from(Accommodation accommodation) {
		return new AccommodationResponse(
				accommodation.getId(),
				accommodation.getName(),
				accommodation.getDescription(),
				accommodation.getCountry(),
				accommodation.getCity(),
				accommodation.getRegion(),
				accommodation.getAddress(),
				accommodation.getAmenities().stream().sorted().toList(),
				accommodation.getCheckInTime(),
				accommodation.getCheckOutTime(),
				accommodation.getTimeZoneId(),
				accommodation.getStatus()
		);
	}
}
