package junsik.reservation.event.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import junsik.reservation.entity.reservation.ReservationOutboxEvent;
import junsik.reservation.enums.ReservationOutboxStatus;
import junsik.reservation.repository.ReservationOutboxEventRepository;

@SpringBootTest(properties =
		"spring.datasource.url=jdbc:h2:mem:reservation-outbox-transaction;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
)
class ReservationOutboxTransactionIntegrationTest {

	@Autowired
	private ReservationEventPublisher eventPublisher;

	@Autowired
	private ReservationOutboxEventRepository outboxEventRepository;

	@Autowired
	private PlatformTransactionManager transactionManager;

	@BeforeEach
	void cleanUp() {
		outboxEventRepository.deleteAll();
	}

	@Test
	void storesTheEventContractAsPendingInsideTheDatabaseTransaction() {
		ReservationCreatedEvent event = createdEvent();

		new TransactionTemplate(transactionManager).executeWithoutResult(status ->
				eventPublisher.publish(event)
		);

		ReservationOutboxEvent stored = outboxEventRepository.findAll().getFirst();
		assertThat(stored.getEventId()).isEqualTo(event.metadata().eventId());
		assertThat(stored.getAggregateType()).isEqualTo("RESERVATION");
		assertThat(stored.getAggregateId()).isEqualTo(101L);
		assertThat(stored.getEventType()).isEqualTo(ReservationEventType.RESERVATION_CREATED);
		assertThat(stored.getEventVersion()).isEqualTo(1);
		assertThat(stored.getStatus()).isEqualTo(ReservationOutboxStatus.PENDING);
		assertThat(stored.getPayload()).contains("\"reservationNumber\":\"RSV-20300101-0000000000000001\"");
		assertThat(stored.getCreatedAt()).isEqualTo(event.metadata().occurredAt());
	}

	@Test
	void rollsBackTheOutboxEventWhenTheOwningDatabaseTransactionRollsBack() {
		new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
			eventPublisher.publish(createdEvent());
			status.setRollbackOnly();
		});

		assertThat(outboxEventRepository.count()).isZero();
	}

	@Test
	void rejectsOutboxWritesWithoutAnExistingBusinessTransaction() {
		assertThatThrownBy(() -> eventPublisher.publish(createdEvent()))
				.isInstanceOf(IllegalTransactionStateException.class);
	}

	private ReservationCreatedEvent createdEvent() {
		return ReservationCreatedEvent.create(
				101L,
				Instant.parse("2030-01-01T00:00:00Z"),
				new ReservationCreatedPayload(
						"RSV-20300101-0000000000000001",
						11L,
						21L,
						2,
						LocalDate.of(2030, 2, 1),
						LocalDate.of(2030, 2, 3),
						new BigDecimal("200000.00")
				)
		);
	}
}
