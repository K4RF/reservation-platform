package junsik.reservation.dto.room.response;

import java.math.BigDecimal;
import java.util.List;

import junsik.reservation.entity.Room;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.RoomStatus;

public record RoomResponse(
		Long roomId,
		Long accommodationId,
		String name,
		int capacity,
		BigDecimal nightlyPrice,
		List<RoomAmenity> amenities,
		RoomStatus status
) {

	public static RoomResponse from(Room room) {
		return new RoomResponse(
				room.getId(),
				room.getAccommodation().getId(),
				room.getName(),
				room.getCapacity(),
				room.getNightlyPrice(),
				room.getAmenities().stream().sorted().toList(),
				room.getStatus()
		);
	}
}
