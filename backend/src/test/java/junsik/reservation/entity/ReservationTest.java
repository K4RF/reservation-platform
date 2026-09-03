package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.ReservationFixture.reservation;
import static junsik.reservation.support.RoomFixture.room;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.global.exception.InvalidReservationStateTransitionException;
import junsik.reservation.global.exception.InvalidReservationStateTransitionException.Operation;

class ReservationTest {

	private static final LocalDate CHECK_IN = LocalDate.of(2030, 1, 10);
	private static final LocalDate CHECK_OUT = LocalDate.of(2030, 1, 15);

	@Test
	void createsReservationAsConfirmedAndTransitionsToCancelled() {
		Reservation reservation = createReservation();

		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);

		reservation.cancel();

		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
	}

	@Test
	void changesConfirmedReservationScheduleAndRecalculatesTotalAmount() {
		Reservation reservation = createReservation();

		reservation.changeSchedule(CHECK_IN, CHECK_IN.plusDays(2));

		assertThat(reservation.getCheckInDate()).isEqualTo(CHECK_IN);
		assertThat(reservation.getCheckOutDate()).isEqualTo(CHECK_IN.plusDays(2));
		assertThat(reservation.getStayNights()).isEqualTo(2);
		assertThat(reservation.getTotalAmount()).isEqualByComparingTo("250000.00");
		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
	}

	@Test
	void rejectsCancellationAndScheduleChangeAfterCancellation() {
		Reservation reservation = createReservation();
		reservation.cancel();

		InvalidReservationStateTransitionException cancellationException = catchThrowableOfType(
				InvalidReservationStateTransitionException.class,
				reservation::cancel
		);
		InvalidReservationStateTransitionException scheduleException = catchThrowableOfType(
				InvalidReservationStateTransitionException.class,
				() -> reservation.changeSchedule(CHECK_IN.plusDays(1), CHECK_OUT.plusDays(1))
		);

		assertThat(cancellationException.getCurrentStatus()).isEqualTo(ReservationStatus.CANCELLED);
		assertThat(cancellationException.getOperation()).isEqualTo(Operation.CANCEL);
		assertThat(scheduleException.getCurrentStatus()).isEqualTo(ReservationStatus.CANCELLED);
		assertThat(scheduleException.getOperation()).isEqualTo(Operation.CHANGE_SCHEDULE);
		assertThat(reservation.getCheckInDate()).isEqualTo(CHECK_IN);
		assertThat(reservation.getCheckOutDate()).isEqualTo(CHECK_OUT);
		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
	}

	private Reservation createReservation() {
		Member member = member();
		Accommodation accommodation = accommodation();
		Room room = room(accommodation, "Deluxe Room", 4, "125000.00");
		return reservation(member, room, CHECK_IN, CHECK_OUT);
	}
}
