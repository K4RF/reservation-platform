package junsik.reservation.global.observability;

import io.micrometer.common.KeyValue;
import io.micrometer.common.KeyValues;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.observation.DefaultServerRequestObservationConvention;
import org.springframework.http.server.observation.ServerRequestObservationContext;

import junsik.reservation.enums.SecurityErrorCode;
import junsik.reservation.global.exception.ErrorCode;

public final class ApiRequestObservationConvention extends DefaultServerRequestObservationConvention {

	public static final String NAME = "http.server.requests";

	@Override
	public KeyValues getLowCardinalityKeyValues(ServerRequestObservationContext context) {
		var response = context.getResponse();
		HttpStatus status = response == null ? null : HttpStatus.resolve(response.getStatus());
		ErrorCode recorded = context.get(HttpErrorMetric.class);
		ErrorCode error = recorded != null && recorded.getStatus() == status ? recorded : null;
		String route = route(context.getPathPattern(), error);
		String code = status == null ? "UNCLASSIFIED" : !status.isError() ? "NONE" :
				error != null ? error.getCode() : "UNCLASSIFIED";
		String outcome = status == null ? "UNKNOWN" : switch (status.series()) {
			case INFORMATIONAL -> "INFORMATIONAL";
			case SUCCESSFUL -> "SUCCESS";
			case REDIRECTION -> "REDIRECT";
			case CLIENT_ERROR -> error == null ? "CLIENT_ERROR" : "EXPECTED_REJECTION";
			case SERVER_ERROR -> "SERVER_ERROR";
		};
		return KeyValues.of(method(context), KeyValue.of("uri", route), KeyValue.of("status",
				status == null ? "UNKNOWN" : Integer.toString(status.value())), KeyValue.of("outcome", outcome),
				KeyValue.of("error_code", code));
	}

	private String route(String pattern, ErrorCode error) {
		if (pattern != null && pattern.startsWith("/api/v1/") && !pattern.contains("*")) {
			return pattern;
		}
		return error == SecurityErrorCode.UNAUTHORIZED || error == SecurityErrorCode.ACCESS_DENIED
				? "SECURITY" : "UNMATCHED";
	}

	@Override
	public KeyValues getHighCardinalityKeyValues(ServerRequestObservationContext context) {
		return KeyValues.empty();
	}

	@Override
	public String getContextualName(ServerRequestObservationContext context) {
		return NAME;
	}
}
