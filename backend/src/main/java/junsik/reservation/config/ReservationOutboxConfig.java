package junsik.reservation.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ReservationOutboxProperties.class)
@ConditionalOnProperty(
		name = {
				"reservation.kafka.enabled",
				"reservation.kafka.outbox.enabled"
		},
		havingValue = "true",
		matchIfMissing = true
)
public class ReservationOutboxConfig {
}
