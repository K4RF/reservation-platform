package junsik.reservation.dto.room.response;

import java.math.BigDecimal;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.entity.room.RoomMetadata;

public record RoomMetadataResponse(
		@Schema(nullable = true) String description,
		@Schema(nullable = true) String bedConfiguration,
		@Schema(description = "객실 면적(㎡)", nullable = true) BigDecimal areaSquareMeters,
		@Schema(nullable = true) String view
) {
	public static RoomMetadataResponse from(RoomMetadata metadata) {
		return new RoomMetadataResponse(metadata.getDescription(), metadata.getBedConfiguration(),
				metadata.getAreaSquareMeters(), metadata.getView());
	}
}
