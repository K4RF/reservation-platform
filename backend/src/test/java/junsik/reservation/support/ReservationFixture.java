package junsik.reservation.support;

import java.time.LocalDate;

import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;

public final class ReservationFixture {

	public static final LocalDate DEFAULT_CHECK_IN = LocalDate.of(2030, 1, 10);
	public static final LocalDate DEFAULT_CHECK_OUT = LocalDate.of(2030, 1, 15);

	private ReservationFixture() {
	}

	public static Reservation reservation(Member member, Room room) {
		return reservation(member, room, DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT);
	}

	public static Reservation reservation(
			Member member,
			Room room,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return Reservation.create(member, room, checkInDate, checkOutDate);
	}
}
