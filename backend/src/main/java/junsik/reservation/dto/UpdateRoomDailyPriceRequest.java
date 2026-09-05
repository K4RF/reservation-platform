package junsik.reservation.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import io.swagger.v3.oas.annotations.media.Schema;

public record UpdateRoomDailyPriceRequest(
		@NotNull(message = "날짜별 객실 가격은 필수입니다.")
		@DecimalMin(value = "0.00", inclusive = false, message = "날짜별 객실 가격은 0보다 커야 합니다.")
		@Digits(integer = 10, fraction = 2, message = "날짜별 객실 가격은 정수 10자리와 소수 2자리 이하여야 합니다.")
		@Schema(description = "변경할 날짜별 1박 가격", example = "200000.00", minimum = "0", exclusiveMinimum = true)
		BigDecimal nightlyPrice
) {
}
