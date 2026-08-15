package junsik.reservation.dto;

import junsik.reservation.entity.Room;

public record RoomResponse(
		Long roomId,
		Long accommodationId,
		String name,
		int capacity
) {

	public static RoomResponse from(Room room) {
		return new RoomResponse(
				room.getId(),
				room.getAccommodation().getId(),
				room.getName(),
				room.getCapacity()
		);
	}
}
