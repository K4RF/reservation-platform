package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.ReservationFixture.reservation;
import static junsik.reservation.support.ReservationFixture.freeCancellationQuote;
import static junsik.reservation.support.RoomFixture.room;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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
		assertThat(reservation.getGuestCount()).isEqualTo(2);

		reservation.cancel(freeCancellationQuote(reservation));

		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
		assertThat(reservation.getCancelledAt()).isNotNull();
		assertThat(reservation.getCancellationFeeAmount()).isEqualByComparingTo("0.00");
		assertThat(reservation.getRefundAmount()).isEqualByComparingTo(reservation.getTotalAmount());
	}

	@Test
	void changesConfirmedReservationScheduleAndRecalculatesTotalAmount() {
		Reservation reservation = createReservation();

		reservation.changeSchedule(CHECK_IN, CHECK_IN.plusDays(2));

		assertThat(reservation.getCheckInDate()).isEqualTo(CHECK_IN);
		assertThat(reservation.getCheckOutDate()).isEqualTo(CHECK_IN.plusDays(2));
		assertThat(reservation.getStayNights()).isEqualTo(2);
		assertThat(reservation.getTotalAmount()).isEqualByComparingTo("250000.00");
		assertThat(reservation.getNights())
				.extracting(ReservationNight::getStayDate)
				.containsExactly(CHECK_IN, CHECK_IN.plusDays(1));
		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
		assertThat(reservation.getGuestCount()).isEqualTo(2);
	}

	@Test
	void keepsCancellationPolicySnapshotWhenScheduleChanges() {
		Member member = member();
		Room room = room(accommodation(), "Deluxe Room", 4, "125000.00");
		ReservationPeriod period = new ReservationPeriod(CHECK_IN, CHECK_OUT);
		CancellationPolicySnapshot policySnapshot = new CancellationPolicySnapshot(
				10,
				2,
				List.of(CancellationFeeRule.create(2, 65))
		);
		Reservation reservation = Reservation.create(
				member,
				room,
				2,
				CHECK_IN,
				CHECK_OUT,
				ReservationPriceSnapshot.calculate(period, room.getNightlyPrice(), Map.of()),
				policySnapshot
		);

		reservation.changeSchedule(CHECK_IN.plusDays(1), CHECK_OUT.plusDays(1));

		assertThat(reservation.getCancellationPolicySnapshot())
				.usingRecursiveComparison()
				.isEqualTo(policySnapshot);
	}

	@Test
	void rejectsGuestCountOutsideRoomCapacity() {
		Member member = member();
		Accommodation accommodation = accommodation();
		Room room = room(accommodation, "Deluxe Room", 2, "125000.00");

		assertThatThrownBy(() -> reservation(member, room, 0, CHECK_IN, CHECK_OUT))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> reservation(member, room, 3, CHECK_IN, CHECK_OUT))
				.isInstanceOf(IllegalArgumentException.class);
	}

	@Test
	void rejectsCancellationAndScheduleChangeAfterCancellation() {
		Reservation reservation = createReservation();
		reservation.cancel(freeCancellationQuote(reservation));

		InvalidReservationStateTransitionException cancellationException = catchThrowableOfType(
				InvalidReservationStateTransitionException.class,
				() -> reservation.cancel(freeCancellationQuote(reservation))
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
