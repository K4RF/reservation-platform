package junsik.reservation.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.AccommodationResponse;
import junsik.reservation.dto.CreateAccommodationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;

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
	public PageResponse<AccommodationResponse> getAll(int page, int size) {
		PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "id"));
		Page<AccommodationResponse> accommodations = accommodationRepository
				.findAll(pageRequest)
				.map(AccommodationResponse::from);
		return PageResponse.from(accommodations);
	}
}
