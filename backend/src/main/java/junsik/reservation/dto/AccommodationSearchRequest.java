package junsik.reservation.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import org.springframework.format.annotation.DateTimeFormat;

import io.swagger.v3.oas.annotations.media.Schema;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationSortField;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.SortDirection;

public record AccommodationSearchRequest(
		@Size(max = 100, message = "숙소명 검색어는 100자 이하여야 합니다.")
		@Schema(description = "숙소명 부분 검색어", example = "호텔")
		String name,

		@Size(max = 100, message = "도시 검색어는 100자 이하여야 합니다.")
		@Schema(description = "구조화된 도시의 정확한 이름", example = "서울특별시")
		String city,

		@Size(max = 100, message = "지역 검색어는 100자 이하여야 합니다.")
		@Schema(description = "구조화된 지역의 정확한 이름", example = "강남구")
		String region,

		@Schema(description = "모두 보유해야 하는 숙소 공용 편의시설(AND)")
		Set<AccommodationAmenity> accommodationAmenities,

		@Schema(description = "하나의 활성 객실이 모두 보유해야 하는 객실 편의시설(AND)")
		Set<RoomAmenity> roomAmenities,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		@Schema(description = "예약 가능 여부를 확인할 체크인 날짜", example = "2030-01-10")
		LocalDate checkInDate,

		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
		@Schema(description = "예약 가능 여부를 확인할 체크아웃 날짜", example = "2030-01-15")
		LocalDate checkOutDate,

		@Min(value = 1, message = "예약 인원은 1명 이상이어야 합니다.")
		@Schema(description = "활성 객실의 최소 수용 인원", example = "2", minimum = "1")
		Integer guestCount,

		@DecimalMin(value = "0.00", message = "최소 가격은 0 이상이어야 합니다.")
		@Schema(description = "활성 객실 기본 1박 가격의 하한", example = "100000", minimum = "0")
		BigDecimal minPrice,

		@DecimalMin(value = "0.00", message = "최대 가격은 0 이상이어야 합니다.")
		@Schema(description = "활성 객실 기본 1박 가격의 상한", example = "200000", minimum = "0")
		BigDecimal maxPrice,

		@Schema(description = "숙소 운영 상태")
		AccommodationStatus status,

		@Schema(
				description = "기간 내 예약 가능 숙소 여부. 날짜만 입력하면 true로 적용됩니다.",
				example = "true"
		)
		Boolean available,

		@Min(value = 0, message = "페이지는 0 이상이어야 합니다.")
		@Schema(description = "0부터 시작하는 페이지 번호", example = "0", minimum = "0")
		Integer page,

		@Min(value = 1, message = "페이지 크기는 1 이상이어야 합니다.")
		@Max(value = 100, message = "페이지 크기는 100 이하여야 합니다.")
		@Schema(description = "페이지 크기", example = "20", minimum = "1", maximum = "100")
		Integer size,

		@Schema(description = "허용 정렬 필드")
		AccommodationSortField sortBy,

		@Schema(description = "정렬 방향")
		SortDirection direction
) {

	public AccommodationSearchRequest {
		accommodationAmenities = accommodationAmenities == null
				? Set.of()
				: Set.copyOf(accommodationAmenities);
		roomAmenities = roomAmenities == null ? Set.of() : Set.copyOf(roomAmenities);
		if (available == null && (checkInDate != null || checkOutDate != null)) {
			available = true;
		}
		page = page == null ? 0 : page;
		size = size == null ? 20 : size;
		sortBy = sortBy == null ? AccommodationSortField.ID : sortBy;
		direction = direction == null ? SortDirection.ASC : direction;
	}
}
