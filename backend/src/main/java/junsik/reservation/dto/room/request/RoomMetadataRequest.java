package junsik.reservation.dto.room.request;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Size;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.room.RoomMetadata;

public record RoomMetadataRequest(
		@Size(max = RoomMetadata.DESCRIPTION_MAX_LENGTH, message = "객실 설명은 1000자 이하여야 합니다.")
		@Schema(description = "객실 설명(일반 텍스트)", example = "창가에 테이블이 있습니다.", nullable = true)
		String description,
		@Size(max = RoomMetadata.BED_CONFIGURATION_MAX_LENGTH, message = "침대 구성은 100자 이하여야 합니다.")
		@Schema(description = "침대 구성(일반 텍스트)", example = "퀸 1개, 싱글 1개", nullable = true)
		String bedConfiguration,
		@DecimalMin(value = RoomMetadata.MIN_AREA, message = "객실 면적은 0.01㎡ 이상이어야 합니다.")
		@DecimalMax(value = RoomMetadata.MAX_AREA, message = "객실 면적은 9999.99㎡ 이하여야 합니다.")
		@Digits(integer = 4, fraction = 2, message = "객실 면적은 소수점 둘째 자리까지 입력해야 합니다.")
		@Schema(description = "객실 면적(㎡)", example = "28.50", nullable = true)
		BigDecimal areaSquareMeters,
		@Size(max = RoomMetadata.VIEW_MAX_LENGTH, message = "객실 전망은 100자 이하여야 합니다.")
		@Schema(description = "객실 전망(일반 텍스트)", example = "바다 전망", nullable = true)
		String view
) {
	public RoomMetadata toMetadata() {
		return RoomMetadata.of(description, bedConfiguration, areaSquareMeters, view);
	}
}
