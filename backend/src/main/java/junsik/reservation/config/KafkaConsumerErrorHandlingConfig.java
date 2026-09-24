package junsik.reservation.config;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.RetryListener;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
@ConditionalOnProperty(
		name = "reservation.kafka.enabled",
		havingValue = "true",
		matchIfMissing = true
)
@EnableConfigurationProperties(ReservationKafkaConsumerProperties.class)
public class KafkaConsumerErrorHandlingConfig {

	private static final Logger log = LoggerFactory.getLogger(KafkaConsumerErrorHandlingConfig.class);

	@Bean
	DefaultErrorHandler reservationKafkaErrorHandler(
			KafkaTemplate<Object, Object> kafkaTemplate,
			ReservationKafkaConsumerProperties properties
	) {
		DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
				kafkaTemplate,
				(record, exception) -> new TopicPartition(
						properties.deadLetterTopic(),
						record.partition()
				)
		);
		recoverer.setFailIfSendResultIsError(true);
		recoverer.setWaitForSendResultTimeout(properties.deadLetterPublishTimeout());

		DefaultErrorHandler errorHandler = new DefaultErrorHandler(
				recoverer,
				new FixedBackOff(properties.retryBackoff().toMillis(), properties.maxRetries())
		);
		errorHandler.addNotRetryableExceptions(IllegalArgumentException.class);
		errorHandler.setRetryListeners(retryLoggingListener(properties.deadLetterTopic()));
		return errorHandler;
	}

	private RetryListener retryLoggingListener(String deadLetterTopic) {
		return new RetryListener() {
			@Override
			public void failedDelivery(
					ConsumerRecord<?, ?> record,
					Exception exception,
					int deliveryAttempt
			) {
				log.warn(
						"Kafka event delivery failed: topic={}, partition={}, offset={}, key={}, "
								+ "deliveryAttempt={}, exception={}",
						record.topic(),
						record.partition(),
						record.offset(),
						record.key(),
						deliveryAttempt,
						exception.getClass().getName()
				);
			}

			@Override
			public void recovered(ConsumerRecord<?, ?> record, Exception exception) {
				log.warn(
						"Kafka event published to dead letter topic: sourceTopic={}, deadLetterTopic={}, "
								+ "partition={}, offset={}, key={}, exception={}",
						record.topic(),
						deadLetterTopic,
						record.partition(),
						record.offset(),
						record.key(),
						exception.getClass().getName()
				);
			}

			@Override
			public void recoveryFailed(
					ConsumerRecord<?, ?> record,
					Exception original,
					Exception failure
			) {
				log.error(
						"Kafka dead letter publication failed: topic={}, partition={}, offset={}, key={}",
						record.topic(),
						record.partition(),
						record.offset(),
						record.key(),
						failure
				);
			}
		};
	}
}
