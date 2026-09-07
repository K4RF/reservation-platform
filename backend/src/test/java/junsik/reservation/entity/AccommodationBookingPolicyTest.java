package junsik.reservation.entity;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import junsik.reservation.enums.BookingPolicyErrorCode;
import junsik.reservation.global.exception.BusinessException;

class AccommodationBookingPolicyTest {

	private static final LocalDate TODAY = LocalDate.of(2030, 1, 1);

	@Test
	void acceptsInclusiveStayAndAdvanceBoundaries() {
		AccommodationBookingPolicy policy = policy(2, 5, 3, 30);

		assertThatCode(() -> policy.validateReservationPeriod(
				TODAY,
				new ReservationPeriod(TODAY.plusDays(3), TODAY.plusDays(5))
		)).doesNotThrowAnyException();
		assertThatCode(() -> policy.validateReservationPeriod(
				TODAY,
				new ReservationPeriod(TODAY.plusDays(30), TODAY.plusDays(35))
		)).doesNotThrowAnyException();
	}

	@Test
	void rejectsStayOutsideMinimumAndMaximum() {
		AccommodationBookingPolicy policy = policy(2, 5, 0, 30);

		assertPolicyError(
				() -> policy.validateReservationPeriod(
						TODAY,
						new ReservationPeriod(TODAY.plusDays(1), TODAY.plusDays(2))
				),
				BookingPolicyErrorCode.STAY_TOO_SHORT
		);
		assertPolicyError(
				() -> policy.validateReservationPeriod(
						TODAY,
						new ReservationPeriod(TODAY.plusDays(1), TODAY.plusDays(7))
				),
				BookingPolicyErrorCode.STAY_TOO_LONG
		);
	}

	@Test
	void rejectsCheckInOutsideAdvanceBookingWindow() {
		AccommodationBookingPolicy policy = policy(1, 10, 3, 30);

		assertPolicyError(
				() -> policy.validateReservationPeriod(
						TODAY,
						new ReservationPeriod(TODAY.plusDays(2), TODAY.plusDays(3))
				),
				BookingPolicyErrorCode.ADVANCE_TOO_SHORT
		);
		assertPolicyError(
				() -> policy.validateReservationPeriod(
						TODAY,
						new ReservationPeriod(TODAY.plusDays(31), TODAY.plusDays(32))
				),
				BookingPolicyErrorCode.ADVANCE_TOO_LONG
		);
	}

	@Test
	void rejectsInvertedPolicyRanges() {
		assertPolicyError(() -> policy(5, 4, 0, 30), BookingPolicyErrorCode.INVALID_STAY_RANGE);
		assertPolicyError(() -> policy(1, 5, 10, 9), BookingPolicyErrorCode.INVALID_ADVANCE_RANGE);
	}

	private AccommodationBookingPolicy policy(
			int minStayNights,
			int maxStayNights,
			int minAdvanceBookingDays,
			int maxAdvanceBookingDays
	) {
		return AccommodationBookingPolicy.create(
				accommodation(),
				minStayNights,
				maxStayNights,
				minAdvanceBookingDays,
				maxAdvanceBookingDays
		);
	}

	private void assertPolicyError(Runnable operation, BookingPolicyErrorCode errorCode) {
		assertThatThrownBy(operation::run)
				.isInstanceOfSatisfying(BusinessException.class, exception ->
						org.assertj.core.api.Assertions.assertThat(exception.getErrorCode()).isEqualTo(errorCode));
	}
}
