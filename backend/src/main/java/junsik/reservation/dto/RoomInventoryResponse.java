package junsik.reservation.dto;

import java.time.LocalDate;

import junsik.reservation.entity.RoomInventory;

public record RoomInventoryResponse(
		Long inventoryId,
		Long roomId,
		LocalDate inventoryDate,
		int totalQuantity,
		int reservedQuantity,
		int availableQuantity
) {

	public static RoomInventoryResponse from(RoomInventory inventory) {
		return new RoomInventoryResponse(
				inventory.getId(),
				inventory.getRoom().getId(),
				inventory.getInventoryDate(),
				inventory.getTotalQuantity(),
				inventory.getReservedQuantity(),
				inventory.getAvailableQuantity()
		);
	}
}
