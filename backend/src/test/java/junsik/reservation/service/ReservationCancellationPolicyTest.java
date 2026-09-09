package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.ReservationFixture.reservation;
import static junsik.reservation.support.RoomFixture.room;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.Set;

import org.junit.jupiter.api.Test;

import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.ReservationCancellationQuote;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.global.exception.BusinessException;

class ReservationCancellationPolicyTest {

	private static final LocalDate TODAY = LocalDate.of(2030, 1, 1);
	private static final Clock FIXED_CLOCK = Clock.fixed(
			Instant.parse("2029-12-31T15:00:00Z"),
			ZoneOffset.UTC
	);
	private final ReservationCancellationPolicy policy = new ReservationCancellationPolicy(
			new ReservationDateProvider(FIXED_CLOCK)
	);

	@Test
	void appliesFreeCancellationFromSevenDaysBeforeCheckIn() {
		ReservationCancellationQuote quote = policy.evaluate(reservationWithCheckInAfter(7));

		assertThat(quote.cancellationDate()).isEqualTo(TODAY);
		assertThat(quote.daysBeforeCheckIn()).isEqualTo(7);
		assertThat(quote.cancellationFeeRate()).isZero();
		assertThat(quote.cancellationFeeAmount()).isEqualByComparingTo("0.00");
		assertThat(quote.estimatedRefundAmount()).isEqualByComparingTo("100000.01");
	}

	@Test
	void appliesThirtyPercentFeeFromThreeToSixDaysBeforeCheckIn() {
		ReservationCancellationQuote sixDaysBefore = policy.evaluate(reservationWithCheckInAfter(6));
		ReservationCancellationQuote threeDaysBefore = policy.evaluate(reservationWithCheckInAfter(3));

		assertThat(sixDaysBefore.cancellationFeeRate()).isEqualTo(30);
		assertThat(sixDaysBefore.cancellationFeeAmount()).isEqualByComparingTo("30000.00");
		assertThat(sixDaysBefore.estimatedRefundAmount()).isEqualByComparingTo("70000.01");
		assertThat(threeDaysBefore.cancellationFeeRate()).isEqualTo(30);
	}

	@Test
	void appliesFiftyPercentFeeFromOneToTwoDaysBeforeCheckIn() {
		ReservationCancellationQuote twoDaysBefore = policy.evaluate(reservationWithCheckInAfter(2));
		ReservationCancellationQuote oneDayBefore = policy.evaluate(reservationWithCheckInAfter(1));

		assertThat(twoDaysBefore.cancellationFeeRate()).isEqualTo(50);
		assertThat(twoDaysBefore.cancellationFeeAmount()).isEqualByComparingTo("50000.01");
		assertThat(twoDaysBefore.estimatedRefundAmount()).isEqualByComparingTo("50000.00");
		assertThat(oneDayBefore.cancellationFeeRate()).isEqualTo(50);
	}

	@Test
	void rejectsCancellationOnOrAfterCheckInDate() {
		BusinessException onCheckIn = catchThrowableOfType(
				BusinessException.class,
				() -> policy.evaluate(reservationWithCheckInAfter(0))
		);
		BusinessException afterCheckIn = catchThrowableOfType(
				BusinessException.class,
				() -> policy.evaluate(reservationWithCheckInAfter(-1))
		);

		assertThat(onCheckIn.getErrorCode()).isEqualTo(ReservationErrorCode.CANCELLATION_NOT_ALLOWED);
		assertThat(afterCheckIn.getErrorCode()).isEqualTo(ReservationErrorCode.CANCELLATION_NOT_ALLOWED);
	}

	@Test
	void appliesEachAccommodationDateAcrossTheUtcMidnightBoundary() {
		Instant instant = Instant.parse("2030-07-01T03:30:00Z");
		ReservationCancellationPolicy boundaryPolicy = new ReservationCancellationPolicy(
				new ReservationDateProvider(Clock.fixed(instant, ZoneOffset.UTC))
		);
		Reservation tokyoReservation = reservationAt("Asia/Tokyo", LocalDate.of(2030, 7, 7));
		Reservation newYorkReservation = reservationAt("America/New_York", LocalDate.of(2030, 7, 7));

		ReservationCancellationQuote tokyoQuote = boundaryPolicy.evaluate(tokyoReservation);
		ReservationCancellationQuote newYorkQuote = boundaryPolicy.evaluate(newYorkReservation);

		assertThat(tokyoQuote.cancelledAt()).isEqualTo(instant);
		assertThat(newYorkQuote.cancelledAt()).isEqualTo(instant);
		assertThat(tokyoQuote.cancellationDate()).isEqualTo(LocalDate.of(2030, 7, 1));
		assertThat(tokyoQuote.cancellationFeeRate()).isEqualTo(30);
		assertThat(newYorkQuote.cancellationDate()).isEqualTo(LocalDate.of(2030, 6, 30));
		assertThat(newYorkQuote.cancellationFeeRate()).isZero();
	}

	private Reservation reservationWithCheckInAfter(long days) {
		LocalDate checkInDate = TODAY.plusDays(days);
		return reservation(
				member(),
				room(accommodation(), "Deluxe Room", 2, new BigDecimal("100000.01")),
				checkInDate,
				checkInDate.plusDays(1)
		);
	}

	private Reservation reservationAt(String timeZone, LocalDate checkInDate) {
		Accommodation accommodation = Accommodation.create(
				"Time Zone Hotel",
				"Description",
				"Country",
				"City",
				"Region",
				"Address",
				Set.of(),
				LocalTime.of(15, 0),
				LocalTime.of(11, 0),
				timeZone
		);
		return reservation(
				member(),
				room(accommodation, "Deluxe Room", 2, new BigDecimal("100000.01")),
				checkInDate,
				checkInDate.plusDays(1)
		);
	}
}
