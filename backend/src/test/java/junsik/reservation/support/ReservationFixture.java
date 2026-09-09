package junsik.reservation.support;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.ReservationCancellationQuote;
import junsik.reservation.entity.RepresentativeGuest;
import junsik.reservation.entity.Room;

public final class ReservationFixture {

	public static final LocalDate DEFAULT_CHECK_IN = LocalDate.of(2030, 1, 10);
	public static final LocalDate DEFAULT_CHECK_OUT = LocalDate.of(2030, 1, 15);
	public static final int DEFAULT_GUEST_COUNT = 2;
	public static final String DEFAULT_GUEST_NAME = "Test Guest";
	public static final String DEFAULT_GUEST_EMAIL = "guest@example.com";
	public static final String DEFAULT_GUEST_PHONE = "010-1234-5678";

	private ReservationFixture() {
	}

	public static Reservation reservation(Member member, Room room) {
		return reservation(member, room, DEFAULT_GUEST_COUNT, DEFAULT_CHECK_IN, DEFAULT_CHECK_OUT);
	}

	public static Reservation reservation(
			Member member,
			Room room,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return reservation(member, room, DEFAULT_GUEST_COUNT, checkInDate, checkOutDate);
	}

	public static Reservation reservation(
			Member member,
			Room room,
			int guestCount,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return Reservation.create(
				"RSV-20300101-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(),
				member,
				room,
				guestCount,
				new RepresentativeGuest(DEFAULT_GUEST_NAME, DEFAULT_GUEST_EMAIL, DEFAULT_GUEST_PHONE),
				checkInDate,
				checkOutDate
		);
	}

	public static ReservationCancellationQuote freeCancellationQuote(Reservation reservation) {
		LocalDate cancellationDate = reservation.getCheckInDate().minusDays(10);
		return new ReservationCancellationQuote(
				Instant.parse("2030-01-01T00:00:00Z"),
				cancellationDate,
				10,
				0,
				BigDecimal.ZERO.setScale(2),
				reservation.getTotalAmount()
		);
	}
}
