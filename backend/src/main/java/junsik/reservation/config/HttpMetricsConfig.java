package junsik.reservation.config;

import java.util.Set;
import java.util.concurrent.TimeUnit;

import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.config.MeterFilter;
import io.micrometer.core.instrument.distribution.DistributionStatisticConfig;
import io.micrometer.core.instrument.observation.MeterObservationHandler;
import io.micrometer.observation.ObservationPredicate;
import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.http.server.observation.ServerRequestObservationConvention;

import junsik.reservation.global.observability.ApiRequestMeterHandler;
import junsik.reservation.global.observability.ApiRequestObservationConvention;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "reservation.observability.enabled", havingValue = "true")
class HttpMetricsConfig {

	@Bean
	ServerRequestObservationConvention apiRequestObservationConvention() {
		return new ApiRequestObservationConvention();
	}

	@Bean
	@Order(Ordered.HIGHEST_PRECEDENCE)
	MeterObservationHandler<?> apiRequestMeterHandler(MeterRegistry registry) {
		// Boot's first-matching meter handler group keeps the default handler for non-HTTP observations.
		return new ApiRequestMeterHandler(registry);
	}

	@Bean
	ObservationPredicate businessHttpOnly(Environment env) {
		var management = ObservabilityConfig.managementListener(env);
		return (name, context) -> {
			if (!(context instanceof ServerRequestObservationContext server) || server.getCarrier() == null) {
				return true;
			}
			var request = server.getCarrier();
			String actuator = request.getContextPath() + ObservabilityConfig.ACTUATOR;
			String uri = request.getRequestURI();
			return request.getDispatcherType() != DispatcherType.ERROR
					&& !management.matches(request) && !uri.equals(actuator) && !uri.startsWith(actuator + "/");
		};
	}

	@Bean
	MeterFilter httpMetricLabels() {
		var ignoreClassTags = MeterFilter.ignoreTags("error", "exception");
		return new MeterFilter() {
			@Override
			public Meter.Id map(Meter.Id id) {
				return ApiRequestObservationConvention.NAME.equals(id.getName()) ? ignoreClassTags.map(id) : id;
			}
		};
	}

	@Bean
	MeterFilter httpHistogram(@Value("${reservation.observability.http-histogram:true}") boolean enabled) {
		double[] boundaries = Set.of(5L, 10L, 25L, 50L, 100L, 250L, 1000L, 3000L).stream()
				.sorted().mapToDouble(TimeUnit.MILLISECONDS::toNanos).toArray();
		var distribution = DistributionStatisticConfig.builder().percentilesHistogram(false)
				.serviceLevelObjectives(boundaries).build();
		return new MeterFilter() {
			@Override
			public DistributionStatisticConfig configure(Meter.Id id, DistributionStatisticConfig config) {
				return enabled && ApiRequestObservationConvention.NAME.equals(id.getName()) ?
						distribution.merge(config) : config;
			}
		};
	}
}
