package junsik.reservation.event.reservation;

import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.concurrent.CompletableFuture;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseBuilder;
import org.springframework.jdbc.datasource.embedded.EmbeddedDatabaseType;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import junsik.reservation.config.ReservationKafkaProperties;

@SpringJUnitConfig(ReservationEventAfterCommitIntegrationTest.Config.class)
class ReservationEventAfterCommitIntegrationTest {

	@jakarta.annotation.Resource
	private ReservationEventPublisher eventPublisher;

	@jakarta.annotation.Resource
	private KafkaTemplate<Object, Object> kafkaTemplate;

	@jakarta.annotation.Resource
	private PlatformTransactionManager transactionManager;

	private ReservationCreatedEvent event;

	@BeforeEach
	@SuppressWarnings("unchecked")
	void setUp() {
		reset(kafkaTemplate);
		SendResult<Object, Object> result = successfulResult();
		given(kafkaTemplate.send(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
				org.mockito.ArgumentMatchers.any()))
				.willReturn(CompletableFuture.completedFuture(result));
		event = createdEvent();
	}

	@Test
	void sendsOnlyAfterDatabaseTransactionCommits() {
		new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
			eventPublisher.publish(event);
			then(kafkaTemplate).shouldHaveNoInteractions();
		});

		then(kafkaTemplate).should().send("reservation.events.v1", "101", event);
	}

	@Test
	void doesNotSendWhenDatabaseTransactionRollsBack() {
		new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
			eventPublisher.publish(event);
			status.setRollbackOnly();
		});

		then(kafkaTemplate).shouldHaveNoInteractions();
	}

	@SuppressWarnings("unchecked")
	private SendResult<Object, Object> successfulResult() {
		SendResult<Object, Object> result = mock(SendResult.class);
		org.apache.kafka.clients.producer.RecordMetadata metadata = mock();
		given(result.getRecordMetadata()).willReturn(metadata);
		given(metadata.topic()).willReturn("reservation.events.v1");
		return result;
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

	@Configuration(proxyBeanMethods = false)
	@EnableTransactionManagement
	static class Config {

		@Bean
		DataSource dataSource() {
			return new EmbeddedDatabaseBuilder()
					.generateUniqueName(true)
					.setType(EmbeddedDatabaseType.H2)
					.build();
		}

		@Bean
		PlatformTransactionManager transactionManager(DataSource dataSource) {
			return new DataSourceTransactionManager(dataSource);
		}

		@Bean
		@SuppressWarnings("unchecked")
		KafkaTemplate<Object, Object> kafkaTemplate() {
			return mock(KafkaTemplate.class);
		}

		@Bean
		ReservationKafkaProperties reservationKafkaProperties() {
			return new ReservationKafkaProperties(true, "reservation.events.v1", 3, (short) 1);
		}

		@Bean
		KafkaReservationEventProducer kafkaReservationEventProducer(
				KafkaTemplate<Object, Object> kafkaTemplate,
				ReservationKafkaProperties properties
		) {
			return new KafkaReservationEventProducer(kafkaTemplate, properties);
		}

		@Bean
		ReservationEventPublisher reservationEventPublisher(
				ApplicationEventPublisher applicationEventPublisher
		) {
			return new SpringReservationEventPublisher(applicationEventPublisher);
		}
	}
}
