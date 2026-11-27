package junsik.reservation.global.observability;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import io.micrometer.common.KeyValues;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.observation.DefaultMeterObservationHandler;
import io.micrometer.observation.Observation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.observation.ServerRequestObservationContext;
import org.springframework.web.context.request.async.WebAsyncManager;
import org.springframework.web.context.request.async.WebAsyncUtils;

public final class ApiRequestMeterHandler extends DefaultMeterObservationHandler {

	private static final Logger log = LoggerFactory.getLogger(ApiRequestMeterHandler.class);
	// Reserve one tuple and one route for overflow; at most 120 HTTP histogram label sets.
	private static final int ROUTES = 63;
	private static final int TUPLES = 119;
	private static final KeyValues OVERFLOW = KeyValues.of(
			"method", "UNKNOWN", "uri", "OVERFLOW", "status", "UNKNOWN", "outcome", "UNKNOWN", "error_code", "UNCLASSIFIED");

	private final Set<String> routes = new HashSet<>();
	private final Set<KeyValues> tuples = new HashSet<>();
	private final AtomicBoolean failureReported = new AtomicBoolean();

	public ApiRequestMeterHandler(MeterRegistry registry) {
		super(registry, IgnoredMeters.LONG_TASK_TIMER);
	}

	@Override
	public boolean supportsContext(Observation.Context context) {
		return context instanceof ServerRequestObservationContext;
	}

	@Override
	public void onStart(Observation.Context context) {
		try {
			super.onStart(context);
		} catch (RuntimeException failure) {
			reportFailure();
		}
	}

	@Override
	public void onStop(Observation.Context context) {
		synchronized (context) {
			if (context.get(ApiRequestMeterHandler.class) != null || awaitingAsyncRedispatch(context)) {
				return;
			}
			context.put(ApiRequestMeterHandler.class, Boolean.TRUE);
			try {
				if (!admit(context)) {
					context.addLowCardinalityKeyValues(OVERFLOW);
				}
				super.onStop(context);
			} catch (RuntimeException failure) {
				reportFailure();
			}
		}
	}

	private boolean awaitingAsyncRedispatch(Observation.Context context) {
		// Framework 7.0.8 calls stop on both timeout and completion. MVC has queued the
		// timeout result before the first callback, but has not written its HTTP response yet.
		if (context instanceof ServerRequestObservationContext server && server.getCarrier() != null
				&& server.getResponse() != null && !server.getResponse().isCommitted()) {
			return server.getCarrier().getAttribute(WebAsyncUtils.WEB_ASYNC_MANAGER_ATTRIBUTE)
					instanceof WebAsyncManager manager && manager.hasConcurrentResult();
		}
		return false;
	}

	private synchronized boolean admit(Observation.Context context) {
		KeyValues tags = context.getLowCardinalityKeyValues();
		if (tuples.contains(tags)) {
			return true;
		}
		var uri = context.getLowCardinalityKeyValue("uri");
		if (uri == null || tuples.size() >= TUPLES || (!routes.contains(uri.getValue()) && routes.size() >= ROUTES)) {
			return false;
		}
		routes.add(uri.getValue());
		tuples.add(tags);
		return true;
	}

	private void reportFailure() {
		if (failureReported.compareAndSet(false, true)) {
			log.warn("HTTP metrics recording failed; request handling is unchanged");
		}
	}
}
