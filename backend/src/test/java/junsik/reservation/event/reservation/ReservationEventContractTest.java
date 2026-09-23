package junsik.reservation.event.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import tools.jackson.databind.ObjectMapper;

@SpringBootTest
class ReservationEventContractTest {

	private static final Long RESERVATION_ID = 101L;
	private static final Instant OCCURRED_AT = Instant.parse("2030-01-01T00:00:00Z");
	private static final LocalDate CHECK_IN_DATE = LocalDate.of(2030, 2, 1);
	private static final LocalDate CHECK_OUT_DATE = LocalDate.of(2030, 2, 3);

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void definesCreatedChangedAndCancelledContractsWithCommonMetadata() throws Exception {
		ReservationCreatedEvent created = ReservationCreatedEvent.create(
				RESERVATION_ID,
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
		ReservationChangedEvent changed = ReservationChangedEvent.create(
				RESERVATION_ID,
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
		ReservationCancelledEvent cancelled = ReservationCancelledEvent.create(
				RESERVATION_ID,
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

		assertContract(created, ReservationEventType.RESERVATION_CREATED);
		assertContract(changed, ReservationEventType.RESERVATION_CHANGED);
		assertContract(cancelled, ReservationEventType.RESERVATION_CANCELLED);
		assertThat(created.metadata().eventId())
				.isNotEqualTo(changed.metadata().eventId())
				.isNotEqualTo(cancelled.metadata().eventId());
	}

	@Test
	void serializesOnlyExplicitMetadataAndPayloadInsteadOfJpaEntities() throws Exception {
		ReservationCreatedEvent event = ReservationCreatedEvent.create(
				RESERVATION_ID,
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

		String json = objectMapper.writeValueAsString(event);

		assertThat(json)
				.contains("\"aggregateType\":\"RESERVATION\"")
				.contains("\"aggregateId\":101")
				.contains("\"eventType\":\"RESERVATION_CREATED\"")
				.contains("\"schemaVersion\":1")
				.contains("\"reservationNumber\":\"RSV-20300101-0000000000000001\"")
				.doesNotContain("hibernateLazyInitializer", "cancellationFeeRules", "nights");
	}

	@Test
	void rejectsMetadataWhoseTypeDoesNotMatchTheConcreteEvent() {
		ReservationEventMetadata metadata = ReservationEventMetadata.create(
				ReservationEventType.RESERVATION_CANCELLED,
				RESERVATION_ID,
				OCCURRED_AT
		);
		ReservationCreatedPayload payload = new ReservationCreatedPayload(
				"RSV-20300101-0000000000000001",
				11L,
				21L,
				2,
				CHECK_IN_DATE,
				CHECK_OUT_DATE,
				new BigDecimal("200000.00")
		);

		assertThatIllegalArgumentException().isThrownBy(
				() -> new ReservationCreatedEvent(metadata, payload)
		);
	}

	private void assertContract(ReservationEvent event, ReservationEventType eventType) {
		assertThat(event.metadata().aggregateType())
				.isEqualTo(ReservationEventMetadata.RESERVATION_AGGREGATE);
		assertThat(event.metadata().aggregateId()).isEqualTo(RESERVATION_ID);
		assertThat(event.metadata().eventType()).isEqualTo(eventType);
		assertThat(event.metadata().schemaVersion())
				.isEqualTo(ReservationEventMetadata.CURRENT_SCHEMA_VERSION);
		assertThat(event.partitionKey()).isEqualTo(RESERVATION_ID.toString());
		assertThat(event.payload()).isNotNull();
	}
}
