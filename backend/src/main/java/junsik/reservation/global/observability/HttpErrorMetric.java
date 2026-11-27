package junsik.reservation.global.observability;

import java.util.Set;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.web.filter.ServerHttpObservationFilter;

import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.BookingPolicyErrorCode;
import junsik.reservation.enums.CancellationPolicyErrorCode;
import junsik.reservation.enums.MediaErrorCode;
import junsik.reservation.enums.MemberErrorCode;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.enums.RoomDailyPriceErrorCode;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.enums.SecurityErrorCode;
import junsik.reservation.global.exception.CommonErrorCode;
import junsik.reservation.global.exception.ErrorCode;

public final class HttpErrorMetric {

	private static final Set<Class<?>> ERROR_ENUMS = Set.of(CommonErrorCode.class, SecurityErrorCode.class,
			AccommodationErrorCode.class, BookingPolicyErrorCode.class, CancellationPolicyErrorCode.class,
			MediaErrorCode.class, MemberErrorCode.class, ReservationErrorCode.class, RoomDailyPriceErrorCode.class,
			RoomErrorCode.class, RoomInventoryErrorCode.class);

	private HttpErrorMetric() {
	}

	public static void record(HttpServletRequest request, ErrorCode code) {
		if (code instanceof Enum<?> value && ERROR_ENUMS.contains(value.getDeclaringClass())) {
			ServerHttpObservationFilter.findObservationContext(request)
					.ifPresent(context -> context.put(HttpErrorMetric.class, code));
		}
	}
}
