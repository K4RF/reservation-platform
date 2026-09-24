package junsik.reservation.service.reservation;

import java.time.Clock;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.reservation.ProcessedReservationEvent;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.event.reservation.handler.ReservationEventHandlerRegistry;
import junsik.reservation.repository.ProcessedReservationEventRepository;

@Service
public class ReservationEventProcessingTransaction {

	private final ProcessedReservationEventRepository processedEventRepository;
	private final ReservationEventHandlerRegistry handlerRegistry;
	private final Clock clock;

	public ReservationEventProcessingTransaction(
			ProcessedReservationEventRepository processedEventRepository,
			ReservationEventHandlerRegistry handlerRegistry,
			Clock clock
	) {
		this.processedEventRepository = processedEventRepository;
		this.handlerRegistry = handlerRegistry;
		this.clock = clock;
	}

	@Transactional
	public void process(ReservationEvent event) {
		processedEventRepository.saveAndFlush(
				ProcessedReservationEvent.create(event, clock.instant())
		);
		handlerRegistry.handle(event);
	}
}
