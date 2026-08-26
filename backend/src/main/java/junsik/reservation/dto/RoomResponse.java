package junsik.reservation.dto;

import java.math.BigDecimal;

import junsik.reservation.entity.Room;
import junsik.reservation.enums.RoomStatus;

public record RoomResponse(
		Long roomId,
		Long accommodationId,
		String name,
		int capacity,
		BigDecimal nightlyPrice,
		RoomStatus status
) {

	public static RoomResponse from(Room room) {
		return new RoomResponse(
				room.getId(),
				room.getAccommodation().getId(),
				room.getName(),
				room.getCapacity(),
				room.getNightlyPrice(),
				room.getStatus()
		);
	}
}
