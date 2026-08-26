package junsik.reservation.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.AccommodationResponse;
import junsik.reservation.dto.AccommodationSearchRequest;
import junsik.reservation.dto.CreateAccommodationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.UpdateAccommodationRequest;
import junsik.reservation.dto.UpdateAccommodationStatusRequest;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.AccommodationSpecifications;

@Service
public class AccommodationService {

	private final AccommodationRepository accommodationRepository;

	public AccommodationService(AccommodationRepository accommodationRepository) {
		this.accommodationRepository = accommodationRepository;
	}

	@Transactional
	public AccommodationResponse create(CreateAccommodationRequest request) {
		Accommodation accommodation = Accommodation.create(
				request.name().trim(),
				request.description().trim(),
				request.address().trim()
		);
		return AccommodationResponse.from(accommodationRepository.save(accommodation));
	}

	@Transactional(readOnly = true)
	public AccommodationResponse getById(Long accommodationId) {
		return accommodationRepository.findById(accommodationId)
				.map(AccommodationResponse::from)
				.orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND));
	}

	@Transactional(readOnly = true)
	public PageResponse<AccommodationResponse> getAll(AccommodationSearchRequest request) {
		Sort sort = Sort.by(request.direction().toSpringDirection(), request.sortBy().getProperty())
				.and(Sort.by(Sort.Direction.ASC, "id"));
		PageRequest pageRequest = PageRequest.of(request.page(), request.size(), sort);
		Page<AccommodationResponse> accommodations = accommodationRepository
				.findAll(AccommodationSpecifications.nameContains(request.name()), pageRequest)
				.map(AccommodationResponse::from);
		return PageResponse.from(accommodations);
	}

	@Transactional
	public AccommodationResponse update(Long accommodationId, UpdateAccommodationRequest request) {
		Accommodation accommodation = getAccommodation(accommodationId);
		accommodation.update(
				request.name().trim(),
				request.description().trim(),
				request.address().trim()
		);
		return AccommodationResponse.from(accommodation);
	}

	@Transactional
	public AccommodationResponse updateStatus(
			Long accommodationId,
			UpdateAccommodationStatusRequest request
	) {
		Accommodation accommodation = getAccommodation(accommodationId);
		accommodation.changeStatus(request.status());
		return AccommodationResponse.from(accommodation);
	}

	private Accommodation getAccommodation(Long accommodationId) {
		return accommodationRepository.findById(accommodationId)
				.orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND));
	}
}
