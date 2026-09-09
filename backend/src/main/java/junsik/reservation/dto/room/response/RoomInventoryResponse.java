package junsik.reservation.dto.room.response;

import java.time.LocalDate;

import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.RoomInventorySaleStatus;

public record RoomInventoryResponse(
		Long inventoryId,
		Long roomId,
		LocalDate inventoryDate,
		int totalQuantity,
		int reservedQuantity,
		int availableQuantity,
		RoomInventorySaleStatus saleStatus
) {

	public static RoomInventoryResponse from(RoomInventory inventory) {
		return new RoomInventoryResponse(
				inventory.getId(),
				inventory.getRoom().getId(),
				inventory.getInventoryDate(),
				inventory.getTotalQuantity(),
				inventory.getReservedQuantity(),
				inventory.getAvailableQuantity(),
				inventory.getSaleStatus()
		);
	}
}
