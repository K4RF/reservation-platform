package junsik.reservation.event.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import org.apache.kafka.clients.producer.RecordMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.support.SendResult;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import junsik.reservation.repository.ProcessedReservationEventRepository;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;

@SpringBootTest(properties = {
		"reservation.kafka.enabled=true",
		"reservation.kafka.outbox.scheduling-enabled=false",
		"spring.kafka.consumer.group-id=reservation-platform-partition-ordering-integration-test",
		"spring.datasource.url=jdbc:h2:mem:reservation-event-partition-ordering;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@EmbeddedKafka(
		partitions = 3,
		topics = {"reservation.events.v1", "reservation.events.v1.dlt"},
		bootstrapServersProperty = "spring.kafka.bootstrap-servers"
)
@DirtiesContext
class ReservationEventPartitionOrderingIntegrationTest {

	@Autowired
	private KafkaReservationEventProducer producer;

	@Autowired
	private ProcessedReservationEventRepository processedEventRepository;

	@MockitoBean
	private ReservationEventAuditLogService auditLogService;

	@MockitoBean
	private RedissonClient redissonClient;

	@BeforeEach
	void cleanUp() {
		processedEventRepository.deleteAll();
	}

	@Test
	void keepsOneReservationLifecycleOnOnePartitionAndConsumesItInOrder() throws Exception {
		Long reservationId = 101L;
		ReservationCreatedEvent created = createdEvent(reservationId, Instant.parse("2030-01-01T00:00:00Z"));
		ReservationChangedEvent changed = changedEvent(reservationId, Instant.parse("2030-01-01T00:01:00Z"));
		ReservationCancelledEvent cancelled = cancelledEvent(reservationId, Instant.parse("2030-01-01T00:02:00Z"));

		List<RecordMetadata> metadata = List.of(
				publish(created),
				publish(changed),
				publish(cancelled)
		);

		assertThat(metadata)
				.extracting(RecordMetadata::partition)
				.containsOnly(metadata.getFirst().partition());
		assertThat(metadata)
				.extracting(RecordMetadata::offset)
				.containsExactly(
						metadata.getFirst().offset(),
						metadata.getFirst().offset() + 1,
						metadata.getFirst().offset() + 2
				);

		verify(auditLogService, timeout(10_000)).recordCancelled(cancelled);
		InOrder inOrder = inOrder(auditLogService);
		inOrder.verify(auditLogService).recordCreated(created);
		inOrder.verify(auditLogService).recordChanged(changed);
		inOrder.verify(auditLogService).recordCancelled(cancelled);
	}

	@Test
	void distributesDifferentReservationKeysAcrossMultiplePartitions() throws Exception {
		Set<Integer> partitions = new HashSet<>();

		for (long reservationId = 1_001L; reservationId <= 1_024L; reservationId++) {
			partitions.add(publish(createdEvent(
					reservationId,
					Instant.parse("2030-01-01T00:00:00Z").plusSeconds(reservationId)
			)).partition());
		}

		assertThat(partitions).hasSizeGreaterThan(1);
	}

	private RecordMetadata publish(ReservationEvent event) throws Exception {
		SendResult<Object, Object> result = producer.send(event).get(10, TimeUnit.SECONDS);
		return result.getRecordMetadata();
	}

	private ReservationCreatedEvent createdEvent(Long reservationId, Instant occurredAt) {
		return ReservationCreatedEvent.create(
				reservationId,
				occurredAt,
				new ReservationCreatedPayload(
						reservationNumber(reservationId),
						11L,
						21L,
						2,
						LocalDate.of(2030, 2, 1),
						LocalDate.of(2030, 2, 3),
						new BigDecimal("200000.00")
				)
		);
	}

	private ReservationChangedEvent changedEvent(Long reservationId, Instant occurredAt) {
		return ReservationChangedEvent.create(
				reservationId,
				occurredAt,
				new ReservationChangedPayload(
						reservationNumber(reservationId),
						11L,
						21L,
						LocalDate.of(2030, 2, 1),
						LocalDate.of(2030, 2, 3),
						LocalDate.of(2030, 2, 2),
						LocalDate.of(2030, 2, 4),
						new BigDecimal("220000.00")
				)
		);
	}

	private ReservationCancelledEvent cancelledEvent(Long reservationId, Instant occurredAt) {
		return ReservationCancelledEvent.create(
				reservationId,
				occurredAt,
				new ReservationCancelledPayload(
						reservationNumber(reservationId),
						11L,
						21L,
						LocalDate.of(2030, 2, 2),
						LocalDate.of(2030, 2, 4),
						occurredAt,
						new BigDecimal("66000.00"),
						new BigDecimal("154000.00")
				)
		);
	}

	private String reservationNumber(Long reservationId) {
		return "RSV-20300101-" + String.format("%016X", reservationId);
	}
}
