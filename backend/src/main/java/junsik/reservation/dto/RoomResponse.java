package junsik.reservation.dto;

import java.math.BigDecimal;

import junsik.reservation.entity.Room;

public record RoomResponse(
		Long roomId,
		Long accommodationId,
		String name,
		int capacity,
		BigDecimal nightlyPrice
) {

	public static RoomResponse from(Room room) {
		return new RoomResponse(
				room.getId(),
				room.getAccommodation().getId(),
				room.getName(),
				room.getCapacity(),
				room.getNightlyPrice()
		);
	}
}
