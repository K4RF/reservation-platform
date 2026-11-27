package junsik.reservation.global.observability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.micrometer.common.KeyValues;
import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.config.MeterFilter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class ApiRequestMeterHandlerTest {

	private final SimpleMeterRegistry registry = new SimpleMeterRegistry();

	@AfterEach
	void closeRegistry() {
		registry.close();
	}

	@Test
	void boundsCombinedLabelSetsWithoutDroppingOverflowRequests() {
		var handler = new ApiRequestMeterHandler(registry);
		for (int i = 0; i < 130; i++) {
			recordTwice(handler, context("/api/v1/reservations", "TEST_" + i));
		}
		var timers = registry.find(ApiRequestObservationConvention.NAME).timers();
		assertThat(timers).hasSize(120);
		assertThat(timers.stream().mapToLong(Timer::count).sum()).isEqualTo(130);
		assertThat(registry.get(ApiRequestObservationConvention.NAME).tag("uri", "OVERFLOW").timer().count())
				.isEqualTo(11);
	}

	@Test
	void boundsRoutesEvenBeforeTheTotalLabelBudgetIsExhausted() {
		var handler = new ApiRequestMeterHandler(registry);
		for (int i = 0; i < 70; i++) {
			recordTwice(handler, context("/api/v1/template-" + i, "NONE"));
		}
		var timers = registry.find(ApiRequestObservationConvention.NAME).timers();
		assertThat(timers).hasSize(64);
		assertThat(timers.stream().mapToLong(Timer::count).sum()).isEqualTo(70);
	}

	@Test
	void doesNotPropagateAnUnavailableRegistryToTheRequest() {
		registry.config().meterFilter(new MeterFilter() {
			@Override
			public Meter.Id map(Meter.Id id) {
				throw new IllegalStateException("synthetic registry failure");
			}
		});
		var handler = new ApiRequestMeterHandler(registry);
		assertThatCode(() -> recordTwice(handler, context("/api/v1/reservations", "NONE")))
				.doesNotThrowAnyException();
	}

	private void recordTwice(ApiRequestMeterHandler handler, ServerRequestObservationContext context) {
		handler.onStart(context);
		handler.onStop(context);
		handler.onStop(context);
	}

	private ServerRequestObservationContext context(String route, String errorCode) {
		var context = new ServerRequestObservationContext(new MockHttpServletRequest(), new MockHttpServletResponse());
		context.setName(ApiRequestObservationConvention.NAME);
		context.addLowCardinalityKeyValues(KeyValues.of(
				"uri", route, "method", "GET", "status", "200", "outcome", "SUCCESS", "error_code", errorCode));
		return context;
	}
}
