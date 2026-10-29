package junsik.reservation.service.accommodation;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.config.RedisCacheConfig;
import junsik.reservation.dto.accommodation.request.AccommodationSearchRequest;
import junsik.reservation.dto.accommodation.request.CreateAccommodationRequest;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationRequest;
import junsik.reservation.dto.accommodation.request.UpdateAccommodationStatusRequest;
import junsik.reservation.dto.accommodation.response.AccommodationResponse;
import junsik.reservation.dto.common.response.PageResponse;
import junsik.reservation.dto.media.response.MediaResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.AccommodationSpecifications;
import junsik.reservation.service.media.CatalogMediaReadService;

@Service
public class AccommodationService {

	private final AccommodationRepository accommodationRepository;
	private final AccommodationBookingPolicyService bookingPolicyService;
	private final CatalogMediaReadService mediaService;

	public AccommodationService(
			AccommodationRepository accommodationRepository,
			AccommodationBookingPolicyService bookingPolicyService,
			CatalogMediaReadService mediaService
	) {
		this.accommodationRepository = accommodationRepository;
		this.bookingPolicyService = bookingPolicyService;
		this.mediaService = mediaService;
	}

	@Transactional
	public AccommodationResponse create(CreateAccommodationRequest request) {
		Accommodation accommodation = Accommodation.create(
				request.name().trim(),
				request.description().trim(),
				request.country(),
				request.city(),
				request.region(),
				request.address(),
				request.amenities(),
				request.checkInTime(),
				request.checkOutTime(),
				request.timeZone()
		);
		return AccommodationResponse.from(accommodationRepository.save(accommodation));
	}

	@Transactional(readOnly = true)
	@Cacheable(cacheNames = RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE, key = "#p0", sync = true)
	public AccommodationResponse getById(Long accommodationId) {
		return detailResponse(getAccommodation(accommodationId));
	}

	@Transactional(readOnly = true)
	public PageResponse<AccommodationResponse> getAll(AccommodationSearchRequest request) {
		validateSearchRequest(request);
		Sort sort = Sort.by(request.direction().toSpringDirection(), request.sortBy().getProperty())
				.and(Sort.by(Sort.Direction.ASC, "id"));
		PageRequest pageRequest = PageRequest.of(request.page(), request.size(), sort);
		Map<String, LocalDate> todayByTimeZone = accommodationRepository.findDistinctTimeZoneIds()
				.stream()
				.collect(Collectors.toMap(
						timeZone -> timeZone,
						timeZone -> bookingPolicyService.today(ZoneId.of(timeZone))
				));
		Page<Accommodation> accommodations = accommodationRepository
				.findAll(AccommodationSpecifications.withFilters(
						request,
						todayByTimeZone
				), pageRequest);
		Map<Long, List<MediaResponse>> images = mediaService.accommodationImages(
				accommodations.getContent().stream().map(Accommodation::getId).toList(), 1);
		return PageResponse.from(accommodations.map(accommodation -> AccommodationResponse.from(
				accommodation, images.getOrDefault(accommodation.getId(), List.of()))));
	}

	@Transactional
	@CacheEvict(
			cacheNames = RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
			key = "#p0",
			beforeInvocation = false
	)
	public AccommodationResponse update(Long accommodationId, UpdateAccommodationRequest request) {
		Accommodation accommodation = getAccommodation(accommodationId);
		accommodation.update(
				request.name().trim(),
				request.description().trim(),
				request.country(),
				request.city(),
				request.region(),
				request.address(),
				request.amenities(),
				request.checkInTime(),
				request.checkOutTime(),
				request.timeZone()
		);
		return detailResponse(accommodation);
	}

	@Transactional
	@CacheEvict(
			cacheNames = RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE,
			key = "#p0",
			beforeInvocation = false
	)
	public AccommodationResponse updateStatus(
			Long accommodationId,
			UpdateAccommodationStatusRequest request
	) {
		Accommodation accommodation = getAccommodation(accommodationId);
		accommodation.changeStatus(request.status());
		return detailResponse(accommodation);
	}

	private AccommodationResponse detailResponse(Accommodation accommodation) {
		List<MediaResponse> images = mediaService.accommodationImages(
				List.of(accommodation.getId()), CatalogMediaReadService.GALLERY_LIMIT)
				.getOrDefault(accommodation.getId(), List.of());
		return AccommodationResponse.from(accommodation, images);
	}

	private Accommodation getAccommodation(Long accommodationId) {
		return accommodationRepository.findById(accommodationId)
				.orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND));
	}

	private void validateSearchRequest(AccommodationSearchRequest request) {
		boolean hasCheckIn = request.checkInDate() != null;
		boolean hasCheckOut = request.checkOutDate() != null;
		if (hasCheckIn != hasCheckOut
				|| (hasCheckIn && !request.checkInDate().isBefore(request.checkOutDate()))) {
			throw new BusinessException(AccommodationErrorCode.INVALID_SEARCH_PERIOD);
		}
		if (request.available() != null && !hasCheckIn) {
			throw new BusinessException(AccommodationErrorCode.AVAILABILITY_REQUIRES_PERIOD);
		}
		if (request.minPrice() != null
				&& request.maxPrice() != null
				&& request.minPrice().compareTo(request.maxPrice()) > 0) {
			throw new BusinessException(AccommodationErrorCode.INVALID_PRICE_RANGE);
		}
	}
}
