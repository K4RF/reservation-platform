package junsik.reservation.event.reservation;

import java.time.LocalDate;

import org.springframework.stereotype.Component;

import junsik.reservation.entity.reservation.Reservation;
import junsik.reservation.service.reservation.ReservationDateProvider;

@Component
public class ReservationEventFactory {

	private final ReservationDateProvider dateProvider;

	public ReservationEventFactory(ReservationDateProvider dateProvider) {
		this.dateProvider = dateProvider;
	}

	public ReservationCreatedEvent created(Reservation reservation) {
		return ReservationCreatedEvent.create(
				reservation.getId(),
				dateProvider.now(),
				new ReservationCreatedPayload(
						reservation.getReservationNumber(),
						reservation.getMember().getId(),
						reservation.getRoom().getId(),
						reservation.getGuestCount(),
						reservation.getCheckInDate(),
						reservation.getCheckOutDate(),
						reservation.getTotalAmount()
				)
		);
	}

	public ReservationChangedEvent changed(
			Reservation reservation,
			LocalDate previousCheckInDate,
			LocalDate previousCheckOutDate
	) {
		return ReservationChangedEvent.create(
				reservation.getId(),
				dateProvider.now(),
				new ReservationChangedPayload(
						reservation.getReservationNumber(),
						reservation.getMember().getId(),
						reservation.getRoom().getId(),
						previousCheckInDate,
						previousCheckOutDate,
						reservation.getCheckInDate(),
						reservation.getCheckOutDate(),
						reservation.getTotalAmount()
				)
		);
	}

	public ReservationCancelledEvent cancelled(Reservation reservation) {
		return ReservationCancelledEvent.create(
				reservation.getId(),
				reservation.getCancelledAt(),
				new ReservationCancelledPayload(
						reservation.getReservationNumber(),
						reservation.getMember().getId(),
						reservation.getRoom().getId(),
						reservation.getCheckInDate(),
						reservation.getCheckOutDate(),
						reservation.getCancelledAt(),
						reservation.getCancellationFeeAmount(),
						reservation.getRefundAmount()
				)
		);
	}
}
