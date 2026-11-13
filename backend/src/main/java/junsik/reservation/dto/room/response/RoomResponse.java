package junsik.reservation.dto.room.response;

import java.math.BigDecimal;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.dto.media.response.MediaResponse;
import junsik.reservation.entity.room.Room;
import junsik.reservation.entity.room.RoomMetadata;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.RoomStatus;

public record RoomResponse(
		Long roomId,
		Long accommodationId,
		String name,
		int capacity,
		BigDecimal nightlyPrice,
		List<RoomAmenity> amenities,
		RoomStatus status,
		@Schema(description = "sortOrder, mediaId 오름차순의 첫 객실 이미지. 없으면 null", nullable = true)
		MediaResponse representativeImage,
		@Schema(description = "상세/수정 응답 최대 20장, 목록/가용 객실 응답 대표 1장. 없으면 빈 배열")
		List<MediaResponse> images,
		@JsonInclude(JsonInclude.Include.NON_NULL)
		@Schema(description = "객실 상세와 관리 응답에만 포함. 미등록 또는 목록/가용 객실 응답에서는 생략")
		RoomMetadataResponse metadata
) {
	public RoomResponse {
		images = images == null ? List.of() : List.copyOf(images);
	}

	public static RoomResponse from(Room room, List<MediaResponse> images) {
		return from(room, images, null);
	}

	public static RoomResponse detail(Room room, List<MediaResponse> images) {
		RoomMetadata metadata = room.getMetadata();
		return from(room, images, metadata == null ? null : RoomMetadataResponse.from(metadata));
	}

	private static RoomResponse from(Room room, List<MediaResponse> images, RoomMetadataResponse metadata) {
		return new RoomResponse(
				room.getId(),
				room.getAccommodation().getId(),
				room.getName(),
				room.getCapacity(),
				room.getNightlyPrice(),
				room.getAmenities().stream().sorted().toList(),
				room.getStatus(),
				images.isEmpty() ? null : images.getFirst(),
				images,
				metadata
		);
	}
}
