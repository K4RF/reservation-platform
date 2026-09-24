package junsik.reservation.service.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import junsik.reservation.event.reservation.ReservationCreatedEvent;
import junsik.reservation.event.reservation.ReservationCreatedPayload;
import junsik.reservation.event.reservation.handler.ReservationEventHandlerRegistry;
import junsik.reservation.repository.ProcessedReservationEventRepository;
import junsik.reservation.support.MySqlIntegrationTestSupport;

class ReservationEventIdempotencyIntegrationTest extends MySqlIntegrationTestSupport {

	@Autowired
	private ReservationEventIdempotencyService idempotencyService;

	@Autowired
	private ReservationEventProcessingTransaction processingTransaction;

	@Autowired
	private ProcessedReservationEventRepository processedEventRepository;

	@MockitoBean
	private ReservationEventHandlerRegistry handlerRegistry;

	private ExecutorService executor;

	@BeforeEach
	void setUp() {
		processedEventRepository.deleteAll();
		executor = Executors.newFixedThreadPool(2);
	}

	@AfterEach
	void tearDown() {
		executor.shutdownNow();
	}

	@Test
	void skipsTheSameEventAfterAConsumerServiceRestart() {
		ReservationCreatedEvent event = createdEvent();

		assertThat(idempotencyService.process(event))
				.isEqualTo(ReservationEventProcessingResult.PROCESSED);

		ReservationEventIdempotencyService restartedService =
				new ReservationEventIdempotencyService(processingTransaction, processedEventRepository);

		assertThat(restartedService.process(event))
				.isEqualTo(ReservationEventProcessingResult.DUPLICATE);
		verify(handlerRegistry).handle(event);
		assertStoredEvent(event);
	}

	@Test
	void rollsBackTheProcessedMarkerWhenTheHandlerFailsAndAllowsRetry() {
		ReservationCreatedEvent event = createdEvent();
		RuntimeException failure = new RuntimeException("post-processing failed");
		doThrow(failure).doNothing().when(handlerRegistry).handle(event);

		assertThatThrownBy(() -> idempotencyService.process(event)).isSameAs(failure);
		assertThat(processedEventRepository.count()).isZero();

		assertThat(idempotencyService.process(event))
				.isEqualTo(ReservationEventProcessingResult.PROCESSED);
		verify(handlerRegistry, times(2)).handle(event);
		assertStoredEvent(event);
	}

	@Test
	void letsOnlyOneConcurrentDeliveryExecuteTheHandler() throws Exception {
		ReservationCreatedEvent event = createdEvent();
		CountDownLatch handlerStarted = new CountDownLatch(1);
		CountDownLatch releaseHandler = new CountDownLatch(1);
		doAnswer(invocation -> {
			handlerStarted.countDown();
			if (!releaseHandler.await(5, TimeUnit.SECONDS)) {
				throw new IllegalStateException("handler release timed out");
			}
			return null;
		}).when(handlerRegistry).handle(event);

		Future<ReservationEventProcessingResult> first = executor.submit(() -> idempotencyService.process(event));
		assertThat(handlerStarted.await(5, TimeUnit.SECONDS)).isTrue();
		Future<ReservationEventProcessingResult> second = executor.submit(() -> idempotencyService.process(event));
		releaseHandler.countDown();

		assertThat(List.of(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS)))
				.containsExactlyInAnyOrder(
						ReservationEventProcessingResult.PROCESSED,
						ReservationEventProcessingResult.DUPLICATE
				);
		verify(handlerRegistry).handle(event);
		assertStoredEvent(event);
	}

	private void assertStoredEvent(ReservationCreatedEvent event) {
		assertThat(processedEventRepository.findAll())
				.singleElement()
				.satisfies(processed -> {
					assertThat(processed.getEventId()).isEqualTo(event.metadata().eventId());
					assertThat(processed.getEventType()).isEqualTo(event.metadata().eventType());
					assertThat(processed.getAggregateId()).isEqualTo(event.metadata().aggregateId());
					assertThat(processed.getProcessedAt()).isNotNull();
				});
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
