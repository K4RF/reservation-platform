package junsik.reservation.event.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import junsik.reservation.entity.reservation.ReservationOutboxEvent;
import junsik.reservation.enums.ReservationOutboxStatus;
import junsik.reservation.repository.ReservationOutboxEventRepository;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;
import junsik.reservation.service.reservation.ReservationOutboxPublisher;

@SpringBootTest(properties = {
		"reservation.kafka.enabled=true",
		"reservation.kafka.outbox.enabled=true",
		"reservation.kafka.outbox.scheduling-enabled=false",
		"spring.kafka.consumer.group-id=reservation-platform-outbox-integration-test",
		"spring.datasource.url=jdbc:h2:mem:reservation-outbox-kafka;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@EmbeddedKafka(
		partitions = 3,
		topics = "reservation.events.v1",
		bootstrapServersProperty = "spring.kafka.bootstrap-servers"
)
@DirtiesContext
class ReservationOutboxKafkaIntegrationTest {

	@Autowired
	private ReservationEventPublisher eventPublisher;

	@Autowired
	private ReservationOutboxPublisher outboxPublisher;

	@Autowired
	private ReservationOutboxEventRepository outboxEventRepository;

	@Autowired
	private PlatformTransactionManager transactionManager;

	@MockitoBean
	private ReservationEventAuditLogService auditLogService;

	@BeforeEach
	void cleanUp() {
		outboxEventRepository.deleteAll();
	}

	@Test
	void publishesACommittedOutboxEventAndMarksItPublishedAfterKafkaAcknowledgement() {
		ReservationCreatedEvent event = createdEvent();
		new TransactionTemplate(transactionManager).executeWithoutResult(status ->
				eventPublisher.publish(event)
		);

		assertThat(outboxEventRepository.findAll().getFirst().getStatus())
				.isEqualTo(ReservationOutboxStatus.PENDING);

		assertThat(outboxPublisher.publishPendingBatch()).isOne();

		ReservationOutboxEvent published = outboxEventRepository.findAll().getFirst();
		assertThat(published.getStatus()).isEqualTo(ReservationOutboxStatus.PUBLISHED);
		assertThat(published.getPublishedAt()).isNotNull();
		assertThat(published.getPublishAttempts()).isOne();
		verify(auditLogService, timeout(10_000)).recordCreated(event);
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
