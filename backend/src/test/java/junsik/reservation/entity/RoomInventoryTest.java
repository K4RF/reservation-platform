package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomFixture.room;
import static junsik.reservation.support.RoomInventoryFixture.DEFAULT_DATE;
import static junsik.reservation.support.RoomInventoryFixture.roomInventory;

import org.junit.jupiter.api.Test;

import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;

class RoomInventoryTest {

	@Test
	void createsInventoryAndCalculatesAvailableQuantity() {
		Room room = room(accommodation());

		RoomInventory inventory = roomInventory(room);

		assertThat(inventory.getRoom()).isSameAs(room);
		assertThat(inventory.getInventoryDate()).isEqualTo(DEFAULT_DATE);
		assertThat(inventory.getTotalQuantity()).isEqualTo(3);
		assertThat(inventory.getReservedQuantity()).isZero();
		assertThat(inventory.getAvailableQuantity()).isEqualTo(3);
	}

	@Test
	void reservesAndReleasesQuantityWithoutGoingNegative() {
		RoomInventory inventory = roomInventory(room(accommodation()));

		inventory.reserve(2);
		inventory.release(1);

		assertThat(inventory.getReservedQuantity()).isOne();
		assertThat(inventory.getAvailableQuantity()).isEqualTo(2);
	}

	@Test
	void rejectsReservationWhenAvailableQuantityIsInsufficient() {
		RoomInventory inventory = roomInventory(room(accommodation()), DEFAULT_DATE, 2);
		inventory.reserve(2);

		BusinessException exception = catchThrowableOfType(
				BusinessException.class,
				() -> inventory.reserve(1)
		);

		assertThat(exception.getErrorCode()).isEqualTo(RoomInventoryErrorCode.INSUFFICIENT_QUANTITY);
		assertThat(inventory.getReservedQuantity()).isEqualTo(2);
		assertThat(inventory.getAvailableQuantity()).isZero();
	}

	@Test
	void rejectsInvalidQuantityChanges() {
		RoomInventory inventory = roomInventory(room(accommodation()), DEFAULT_DATE, 2);

		assertErrorCode(() -> inventory.reserve(0), RoomInventoryErrorCode.INVALID_QUANTITY);
		assertErrorCode(() -> inventory.release(0), RoomInventoryErrorCode.INVALID_QUANTITY);
		assertErrorCode(() -> inventory.release(1), RoomInventoryErrorCode.RELEASE_EXCEEDS_RESERVED);
		assertErrorCode(() -> inventory.changeTotalQuantity(-1), RoomInventoryErrorCode.INVALID_TOTAL_QUANTITY);
	}

	@Test
	void cannotReduceTotalBelowReservedQuantity() {
		RoomInventory inventory = roomInventory(room(accommodation()), DEFAULT_DATE, 3);
		inventory.reserve(2);

		assertErrorCode(
				() -> inventory.changeTotalQuantity(1),
				RoomInventoryErrorCode.TOTAL_BELOW_RESERVED
		);
		assertThat(inventory.getTotalQuantity()).isEqualTo(3);
	}

	private void assertErrorCode(Runnable operation, RoomInventoryErrorCode errorCode) {
		BusinessException exception = catchThrowableOfType(BusinessException.class, operation::run);
		assertThat(exception.getErrorCode()).isEqualTo(errorCode);
	}
}
