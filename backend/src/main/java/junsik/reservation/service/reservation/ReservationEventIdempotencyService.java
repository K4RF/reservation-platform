package junsik.reservation.service.reservation;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.repository.ProcessedReservationEventRepository;

@Service
public class ReservationEventIdempotencyService {

	private final ReservationEventProcessingTransaction processingTransaction;
	private final ProcessedReservationEventRepository processedEventRepository;

	public ReservationEventIdempotencyService(
			ReservationEventProcessingTransaction processingTransaction,
			ProcessedReservationEventRepository processedEventRepository
	) {
		this.processingTransaction = processingTransaction;
		this.processedEventRepository = processedEventRepository;
	}

	public ReservationEventProcessingResult process(ReservationEvent event) {
		try {
			processingTransaction.process(event);
			return ReservationEventProcessingResult.PROCESSED;
		} catch (DataIntegrityViolationException exception) {
			if (processedEventRepository.existsByEventId(event.metadata().eventId())) {
				return ReservationEventProcessingResult.DUPLICATE;
			}
			throw exception;
		}
	}
}
