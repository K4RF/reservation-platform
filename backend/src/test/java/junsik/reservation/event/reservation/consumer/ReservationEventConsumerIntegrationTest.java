package junsik.reservation.event.reservation.consumer;

import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import junsik.reservation.event.reservation.ReservationCancelledEvent;
import junsik.reservation.event.reservation.ReservationCancelledPayload;
import junsik.reservation.event.reservation.ReservationChangedEvent;
import junsik.reservation.event.reservation.ReservationChangedPayload;
import junsik.reservation.event.reservation.ReservationCreatedEvent;
import junsik.reservation.event.reservation.ReservationCreatedPayload;
import junsik.reservation.event.reservation.ReservationEvent;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;

@SpringBootTest(properties = {
		"reservation.kafka.enabled=true",
		"spring.kafka.consumer.group-id=reservation-platform-reservation-post-processing-integration-test"
})
@EmbeddedKafka(
		partitions = 3,
		topics = "reservation.events.v1",
		bootstrapServersProperty = "spring.kafka.bootstrap-servers"
)
@DirtiesContext
class ReservationEventConsumerIntegrationTest {

	private static final String TOPIC = "reservation.events.v1";
	private static final Instant OCCURRED_AT = Instant.parse("2030-01-01T00:00:00Z");
	private static final LocalDate CHECK_IN_DATE = LocalDate.of(2030, 2, 1);
	private static final LocalDate CHECK_OUT_DATE = LocalDate.of(2030, 2, 3);

	@Autowired
	private KafkaTemplate<Object, Object> kafkaTemplate;

	@MockitoBean
	private ReservationEventAuditLogService auditLogService;

	@Test
	void deserializesAndDispatchesAllReservationEventTypes() throws Exception {
		ReservationCreatedEvent created = createdEvent();
		ReservationChangedEvent changed = changedEvent();
		ReservationCancelledEvent cancelled = cancelledEvent();

		send(created);
		send(changed);
		send(cancelled);

		verify(auditLogService, timeout(10_000)).recordCreated(created);
		verify(auditLogService, timeout(10_000)).recordChanged(changed);
		verify(auditLogService, timeout(10_000)).recordCancelled(cancelled);
	}

	private void send(ReservationEvent event) throws Exception {
		kafkaTemplate.send(TOPIC, event.partitionKey(), event).get(10, TimeUnit.SECONDS);
	}

	private ReservationCreatedEvent createdEvent() {
		return ReservationCreatedEvent.create(
				101L,
				OCCURRED_AT,
				new ReservationCreatedPayload(
						"RSV-20300101-0000000000000001",
						11L,
						21L,
						2,
						CHECK_IN_DATE,
						CHECK_OUT_DATE,
						new BigDecimal("200000.00")
				)
		);
	}

	private ReservationChangedEvent changedEvent() {
		return ReservationChangedEvent.create(
				101L,
				OCCURRED_AT.plusSeconds(60),
				new ReservationChangedPayload(
						"RSV-20300101-0000000000000001",
						11L,
						21L,
						CHECK_IN_DATE,
						CHECK_OUT_DATE,
						CHECK_IN_DATE.plusDays(1),
						CHECK_OUT_DATE.plusDays(1),
						new BigDecimal("220000.00")
				)
		);
	}

	private ReservationCancelledEvent cancelledEvent() {
		return ReservationCancelledEvent.create(
				101L,
				OCCURRED_AT.plusSeconds(120),
				new ReservationCancelledPayload(
						"RSV-20300101-0000000000000001",
						11L,
						21L,
						CHECK_IN_DATE.plusDays(1),
						CHECK_OUT_DATE.plusDays(1),
						OCCURRED_AT.plusSeconds(120),
						new BigDecimal("66000.00"),
						new BigDecimal("154000.00")
				)
		);
	}
}
