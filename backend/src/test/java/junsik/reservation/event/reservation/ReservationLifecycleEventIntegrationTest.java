package junsik.reservation.event.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.redisson.api.RedissonClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.request.RepresentativeGuestRequest;
import junsik.reservation.dto.reservation.request.UpdateReservationScheduleRequest;
import junsik.reservation.dto.reservation.response.ReservationResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.member.Member;
import junsik.reservation.entity.reservation.ReservationOutboxEvent;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.ReservationOutboxStatus;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ProcessedReservationEventRepository;
import junsik.reservation.repository.ReservationOutboxEventRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.service.reservation.ReservationEventAuditLogService;
import junsik.reservation.service.reservation.ReservationOutboxPublisher;
import junsik.reservation.service.reservation.ReservationService;
import junsik.reservation.support.AccommodationFixture;
import junsik.reservation.support.MemberFixture;
import junsik.reservation.support.RoomFixture;
import junsik.reservation.support.RoomInventoryFixture;

@SpringBootTest(properties = {
		"reservation.kafka.enabled=true",
		"reservation.kafka.outbox.enabled=true",
		"reservation.kafka.outbox.scheduling-enabled=false",
		"spring.kafka.consumer.group-id=reservation-platform-lifecycle-integration-test",
		"spring.datasource.url=jdbc:h2:mem:reservation-lifecycle-events;MODE=MySQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
@EmbeddedKafka(
		partitions = 3,
		topics = {"reservation.events.v1", "reservation.events.v1.dlt"},
		bootstrapServersProperty = "spring.kafka.bootstrap-servers"
)
@DirtiesContext
class ReservationLifecycleEventIntegrationTest {

	private static final LocalDate FIRST_DATE = LocalDate.of(2035, 6, 10);

	@Autowired private MemberRepository memberRepository;
	@Autowired private AccommodationRepository accommodationRepository;
	@Autowired private RoomRepository roomRepository;
	@Autowired private RoomInventoryRepository inventoryRepository;
	@Autowired private ReservationRepository reservationRepository;
	@Autowired private ReservationOutboxEventRepository outboxRepository;
	@Autowired private ProcessedReservationEventRepository processedRepository;
	@Autowired private ReservationService reservationService;
	@Autowired private ReservationOutboxPublisher outboxPublisher;
	@Autowired private ReservationOutboxEventSerializer serializer;

	@MockitoBean private ReservationEventAuditLogService auditLogService;
	@MockitoBean private RedissonClient redissonClient;

	@Test
	void committedReservationLifecycleFlowsThroughOutboxKafkaAndIdempotentConsumer() throws InterruptedException {
		Member member = memberRepository.saveAndFlush(MemberFixture.member("lifecycle@example.com"));
		Accommodation accommodation = accommodationRepository.saveAndFlush(AccommodationFixture.accommodation());
		Room room = roomRepository.saveAndFlush(RoomFixture.room(accommodation));
		for (int day = 0; day < 4; day++) {
			inventoryRepository.saveAndFlush(RoomInventoryFixture.roomInventory(
					room, FIRST_DATE.plusDays(day), 1));
		}

		ReservationResponse created = reservationService.create(member.getId(), new CreateReservationRequest(
				room.getId(), 2, FIRST_DATE, FIRST_DATE.plusDays(2),
				new RepresentativeGuestRequest("Test Guest", "guest@example.com", "010-1234-5678")));
		ReservationResponse changed = reservationService.updateSchedule(member.getId(), created.reservationId(),
				new UpdateReservationScheduleRequest(FIRST_DATE.plusDays(1), FIRST_DATE.plusDays(3)));
		reservationService.cancel(member.getId(), created.reservationId());

		assertThat(reservationRepository.findById(created.reservationId()).orElseThrow().getStatus())
				.isEqualTo(ReservationStatus.CANCELLED);
		assertThat(inventoryRepository.findAllByRoomIdAndInventoryDateBetweenOrderByInventoryDateAsc(
				room.getId(), FIRST_DATE, FIRST_DATE.plusDays(3)))
				.hasSize(4)
				.allSatisfy(inventory -> assertThat(inventory.getReservedQuantity()).isZero());

		List<ReservationOutboxEvent> pending = outboxRepository.findAll().stream()
				.sorted(java.util.Comparator.comparing(ReservationOutboxEvent::getId))
				.toList();
		assertThat(pending).hasSize(3)
				.allSatisfy(event -> {
					assertThat(event.getStatus()).isEqualTo(ReservationOutboxStatus.PENDING);
					assertThat(event.getAggregateId()).isEqualTo(created.reservationId());
					assertThat(event.getAggregateType()).isEqualTo(ReservationEventMetadata.RESERVATION_AGGREGATE);
					assertThat(event.getEventVersion()).isEqualTo(ReservationEventMetadata.CURRENT_SCHEMA_VERSION);
				});
		assertThat(pending.stream().map(ReservationOutboxEvent::getEventId)).doesNotHaveDuplicates();
		assertThat(pending.stream().map(ReservationOutboxEvent::getEventType)).containsExactly(
				ReservationEventType.RESERVATION_CREATED,
				ReservationEventType.RESERVATION_CHANGED,
				ReservationEventType.RESERVATION_CANCELLED);

		ReservationCreatedEvent createdEvent = (ReservationCreatedEvent) deserialize(pending.get(0));
		ReservationChangedEvent changedEvent = (ReservationChangedEvent) deserialize(pending.get(1));
		ReservationCancelledEvent cancelledEvent = (ReservationCancelledEvent) deserialize(pending.get(2));
		assertThat(createdEvent.payload().reservationNumber()).isEqualTo(created.reservationNumber());
		assertThat(createdEvent.payload().totalAmount()).isEqualByComparingTo(created.totalAmount());
		assertThat(changedEvent.payload().previousCheckInDate()).isEqualTo(FIRST_DATE);
		assertThat(changedEvent.payload().checkInDate()).isEqualTo(changed.checkInDate());
		assertThat(changedEvent.payload().totalAmount()).isEqualByComparingTo(changed.totalAmount());
		assertThat(cancelledEvent.payload().reservationNumber()).isEqualTo(created.reservationNumber());
		assertThat(cancelledEvent.payload().checkInDate()).isEqualTo(changed.checkInDate());
		assertThat(cancelledEvent.payload().cancelledAt()).isNotNull();

		assertThat(processedRepository.count()).isZero();
		assertThat(outboxPublisher.publishPendingBatch()).isEqualTo(3);
		assertThat(outboxRepository.findAll()).allSatisfy(event -> {
			assertThat(event.getStatus()).isEqualTo(ReservationOutboxStatus.PUBLISHED);
			assertThat(event.getPublishAttempts()).isOne();
			assertThat(event.getPublishedAt()).isNotNull();
		});

		verify(auditLogService, timeout(10_000)).recordCancelled(cancelledEvent);
		InOrder order = inOrder(auditLogService);
		order.verify(auditLogService).recordCreated(createdEvent);
		order.verify(auditLogService).recordChanged(changedEvent);
		order.verify(auditLogService).recordCancelled(cancelledEvent);
		long deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
		while (processedRepository.count() != 3 && System.nanoTime() < deadline) {
			Thread.sleep(20);
		}
		assertThat(processedRepository.count()).isEqualTo(3);
		assertThat(pending).allSatisfy(event -> assertThat(processedRepository.existsByEventId(event.getEventId())).isTrue());
	}

	private ReservationEvent deserialize(ReservationOutboxEvent event) {
		return serializer.deserialize(event.getEventType(), event.getPayload());
	}
}
