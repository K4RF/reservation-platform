package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomDailyPriceFixture.DEFAULT_NIGHTLY_PRICE;
import static junsik.reservation.support.RoomDailyPriceFixture.DEFAULT_STAY_DATE;
import static junsik.reservation.support.RoomDailyPriceFixture.roomDailyPrice;
import static junsik.reservation.support.RoomFixture.room;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

import junsik.reservation.enums.RoomDailyPriceErrorCode;
import junsik.reservation.global.exception.BusinessException;

class RoomDailyPriceTest {

	@Test
	void createsAndChangesPositiveDailyPrice() {
		Room room = room(accommodation());
		RoomDailyPrice dailyPrice = roomDailyPrice(room);

		assertThat(dailyPrice.getRoom()).isSameAs(room);
		assertThat(dailyPrice.getStayDate()).isEqualTo(DEFAULT_STAY_DATE);
		assertThat(dailyPrice.getNightlyPrice()).isEqualByComparingTo(DEFAULT_NIGHTLY_PRICE);

		dailyPrice.changeNightlyPrice(new BigDecimal("200000.00"));

		assertThat(dailyPrice.getNightlyPrice()).isEqualByComparingTo("200000.00");
	}

	@Test
	void rejectsZeroNegativeAndNullDailyPrice() {
		Room room = room(accommodation());

		assertInvalidPrice(() -> RoomDailyPrice.create(room, DEFAULT_STAY_DATE, BigDecimal.ZERO));
		assertInvalidPrice(() -> RoomDailyPrice.create(room, DEFAULT_STAY_DATE, new BigDecimal("-0.01")));
		assertInvalidPrice(() -> RoomDailyPrice.create(room, DEFAULT_STAY_DATE, null));
	}

	private void assertInvalidPrice(Runnable operation) {
		BusinessException exception = catchThrowableOfType(BusinessException.class, operation::run);
		assertThat(exception.getErrorCode()).isEqualTo(RoomDailyPriceErrorCode.INVALID_PRICE);
	}
}
