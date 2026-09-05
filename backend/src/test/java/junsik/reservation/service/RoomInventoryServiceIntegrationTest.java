package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomFixture.room;
import static junsik.reservation.support.RoomInventoryFixture.DEFAULT_DATE;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.RoomInventoryResponse;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;

@SpringBootTest
@Transactional
class RoomInventoryServiceIntegrationTest {

	@Autowired
	private RoomInventoryService roomInventoryService;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Test
	void createsAndQueriesInventoryByRoomAndDate() {
		Room room = saveRoom();

		RoomInventoryResponse created = roomInventoryService.create(room.getId(), DEFAULT_DATE, 3);
		RoomInventoryResponse found = roomInventoryService.get(room.getId(), DEFAULT_DATE);

		assertThat(created.inventoryId()).isNotNull();
		assertThat(found).isEqualTo(created);
		assertThat(found.totalQuantity()).isEqualTo(3);
		assertThat(found.reservedQuantity()).isZero();
		assertThat(found.availableQuantity()).isEqualTo(3);
	}

	@Test
	void managesEachInventoryDateIndependently() {
		Room room = saveRoom();
		LocalDate firstDate = DEFAULT_DATE;
		LocalDate secondDate = DEFAULT_DATE.plusDays(1);
		roomInventoryService.create(room.getId(), secondDate, 5);
		roomInventoryService.create(room.getId(), firstDate, 2);

		roomInventoryService.reserve(room.getId(), firstDate, 2);

		RoomInventoryResponse first = roomInventoryService.get(room.getId(), firstDate);
		RoomInventoryResponse second = roomInventoryService.get(room.getId(), secondDate);
		List<RoomInventory> period = roomInventoryRepository
				.findAllByRoomIdAndInventoryDateGreaterThanEqualAndInventoryDateLessThanOrderByInventoryDateAsc(
						room.getId(),
						firstDate,
						secondDate.plusDays(1)
				);

		assertThat(first.availableQuantity()).isZero();
		assertThat(second.availableQuantity()).isEqualTo(5);
		assertThat(period).extracting(RoomInventory::getInventoryDate)
				.containsExactly(firstDate, secondDate);
	}

	@Test
	void preventsSequentialReservationsFromExceedingInventory() {
		Room room = saveRoom();
		roomInventoryService.create(room.getId(), DEFAULT_DATE, 2);
		roomInventoryService.reserve(room.getId(), DEFAULT_DATE, 1);
		roomInventoryService.reserve(room.getId(), DEFAULT_DATE, 1);

		assertErrorCode(
				() -> roomInventoryService.reserve(room.getId(), DEFAULT_DATE, 1),
				RoomInventoryErrorCode.INSUFFICIENT_QUANTITY
		);
		assertThat(roomInventoryService.get(room.getId(), DEFAULT_DATE).availableQuantity()).isZero();
	}

	@Test
	void rejectsDuplicateInventoryForSameRoomAndDate() {
		Room room = saveRoom();
		roomInventoryService.create(room.getId(), DEFAULT_DATE, 2);

		assertErrorCode(
				() -> roomInventoryService.create(room.getId(), DEFAULT_DATE, 4),
				RoomInventoryErrorCode.DUPLICATE_DATE
		);
	}

	@Test
	void changesTotalAndReleasesReservedQuantity() {
		Room room = saveRoom();
		roomInventoryService.create(room.getId(), DEFAULT_DATE, 3);
		roomInventoryService.reserve(room.getId(), DEFAULT_DATE, 2);

		RoomInventoryResponse released = roomInventoryService.release(room.getId(), DEFAULT_DATE, 1);
		RoomInventoryResponse changed = roomInventoryService.changeTotalQuantity(room.getId(), DEFAULT_DATE, 4);

		assertThat(released.reservedQuantity()).isOne();
		assertThat(changed.totalQuantity()).isEqualTo(4);
		assertThat(changed.availableQuantity()).isEqualTo(3);
	}

	@Test
	void blocksInventoryCreationAndIncreaseForInactiveRoomButAllowsRelease() {
		Room room = saveRoom();
		roomInventoryService.create(room.getId(), DEFAULT_DATE, 2);
		roomInventoryService.reserve(room.getId(), DEFAULT_DATE, 1);
		room.changeStatus(RoomStatus.INACTIVE);
		roomRepository.flush();

		assertErrorCode(
				() -> roomInventoryService.create(room.getId(), DEFAULT_DATE.plusDays(1), 2),
				RoomInventoryErrorCode.INACTIVE_ROOM
		);
		assertErrorCode(
				() -> roomInventoryService.changeTotalQuantity(room.getId(), DEFAULT_DATE, 3),
				RoomInventoryErrorCode.INACTIVE_ROOM
		);
		assertErrorCode(
				() -> roomInventoryService.reserve(room.getId(), DEFAULT_DATE, 1),
				RoomInventoryErrorCode.INACTIVE_ROOM
		);

		RoomInventoryResponse released = roomInventoryService.release(room.getId(), DEFAULT_DATE, 1);
		assertThat(released.reservedQuantity()).isZero();
		assertThat(released.availableQuantity()).isEqualTo(2);
	}

	private Room saveRoom() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		return roomRepository.saveAndFlush(room(accommodation));
	}

	private void assertErrorCode(Runnable operation, RoomInventoryErrorCode errorCode) {
		BusinessException exception = catchThrowableOfType(BusinessException.class, operation::run);
		assertThat(exception.getErrorCode()).isEqualTo(errorCode);
	}
}
