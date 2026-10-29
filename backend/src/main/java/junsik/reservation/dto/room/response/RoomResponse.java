package junsik.reservation.dto.room.response;

import java.math.BigDecimal;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.dto.media.response.MediaResponse;

import junsik.reservation.entity.room.Room;
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
		List<MediaResponse> images
) {
	public RoomResponse {
		images = images == null ? List.of() : List.copyOf(images);
	}

	public static RoomResponse from(Room room) {
		return from(room, List.of());
	}

	public static RoomResponse from(Room room, List<MediaResponse> images) {
		return new RoomResponse(
				room.getId(),
				room.getAccommodation().getId(),
				room.getName(),
				room.getCapacity(),
				room.getNightlyPrice(),
				room.getAmenities().stream().sorted().toList(),
				room.getStatus(),
				images.isEmpty() ? null : images.getFirst(),
				images
		);
	}
}
