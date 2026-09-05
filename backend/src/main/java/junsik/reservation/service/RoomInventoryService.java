package junsik.reservation.service;

import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.RoomInventoryResponse;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;

@Service
public class RoomInventoryService {

	private final RoomInventoryRepository roomInventoryRepository;
	private final RoomRepository roomRepository;

	public RoomInventoryService(
			RoomInventoryRepository roomInventoryRepository,
			RoomRepository roomRepository
	) {
		this.roomInventoryRepository = roomInventoryRepository;
		this.roomRepository = roomRepository;
	}

	@Transactional
	public RoomInventoryResponse create(Long roomId, LocalDate inventoryDate, int totalQuantity) {
		Room room = getRoom(roomId);
		validateActive(room);
		if (roomInventoryRepository.existsByRoomIdAndInventoryDate(roomId, inventoryDate)) {
			throw new BusinessException(RoomInventoryErrorCode.DUPLICATE_DATE);
		}

		RoomInventory inventory = RoomInventory.create(room, inventoryDate, totalQuantity);
		return RoomInventoryResponse.from(roomInventoryRepository.save(inventory));
	}

	@Transactional(readOnly = true)
	public RoomInventoryResponse get(Long roomId, LocalDate inventoryDate) {
		return RoomInventoryResponse.from(getInventory(roomId, inventoryDate));
	}

	@Transactional
	public RoomInventoryResponse changeTotalQuantity(
			Long roomId,
			LocalDate inventoryDate,
			int totalQuantity
	) {
		RoomInventory inventory = getInventory(roomId, inventoryDate);
		validateActive(inventory.getRoom());
		inventory.changeTotalQuantity(totalQuantity);
		return RoomInventoryResponse.from(inventory);
	}

	@Transactional
	public RoomInventoryResponse reserve(Long roomId, LocalDate inventoryDate, int quantity) {
		RoomInventory inventory = getInventory(roomId, inventoryDate);
		validateActive(inventory.getRoom());
		inventory.reserve(quantity);
		return RoomInventoryResponse.from(inventory);
	}

	@Transactional
	public RoomInventoryResponse release(Long roomId, LocalDate inventoryDate, int quantity) {
		RoomInventory inventory = getInventory(roomId, inventoryDate);
		inventory.release(quantity);
		return RoomInventoryResponse.from(inventory);
	}

	private Room getRoom(Long roomId) {
		return roomRepository.findById(roomId)
				.orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
	}

	private RoomInventory getInventory(Long roomId, LocalDate inventoryDate) {
		return roomInventoryRepository.findByRoomIdAndInventoryDate(roomId, inventoryDate)
				.orElseThrow(() -> new BusinessException(RoomInventoryErrorCode.NOT_FOUND));
	}

	private void validateActive(Room room) {
		if (!room.isActive()) {
			throw new BusinessException(RoomInventoryErrorCode.INACTIVE_ROOM);
		}
	}
}
