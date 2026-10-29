package junsik.reservation.dto.accommodation.response;

import java.time.LocalTime;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.dto.media.response.MediaResponse;

import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationStatus;

public record AccommodationResponse(
		Long accommodationId,
		String name,
		String description,
		String country,
		String city,
		String region,
		String address,
		List<AccommodationAmenity> amenities,
		LocalTime checkInTime,
		LocalTime checkOutTime,
		String timeZone,
		AccommodationStatus status,
		@Schema(description = "sortOrder, mediaId 오름차순의 첫 이미지. 이미지 없으면 null", nullable = true)
		MediaResponse representativeImage,
		@Schema(description = "상세/수정 응답 최대 20장, 검색 응답 대표 1장. 없으면 빈 배열. 정렬은 sortOrder, mediaId 오름차순")
		List<MediaResponse> images
) {
	public AccommodationResponse {
		images = images == null ? List.of() : List.copyOf(images);
	}

	public static AccommodationResponse from(Accommodation accommodation) {
		return from(accommodation, List.of());
	}

	public static AccommodationResponse from(Accommodation accommodation, List<MediaResponse> images) {
		return new AccommodationResponse(
				accommodation.getId(),
				accommodation.getName(),
				accommodation.getDescription(),
				accommodation.getCountry(),
				accommodation.getCity(),
				accommodation.getRegion(),
				accommodation.getAddress(),
				accommodation.getAmenities().stream().sorted().toList(),
				accommodation.getCheckInTime(),
				accommodation.getCheckOutTime(),
				accommodation.getTimeZoneId(),
				accommodation.getStatus(),
				images.isEmpty() ? null : images.getFirst(),
				images
		);
	}
}
