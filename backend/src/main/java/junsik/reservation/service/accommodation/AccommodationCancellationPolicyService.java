package junsik.reservation.service.accommodation;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.accommodation.request.AccommodationCancellationPolicyRequest;
import junsik.reservation.dto.accommodation.response.AccommodationCancellationPolicyResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.accommodation.AccommodationCancellationPolicy;
import junsik.reservation.entity.accommodation.CancellationFeeRule;
import junsik.reservation.entity.reservation.CancellationPolicySnapshot;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.CancellationPolicyErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationCancellationPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;

@Service
public class AccommodationCancellationPolicyService {

	private final AccommodationCancellationPolicyRepository cancellationPolicyRepository;
	private final AccommodationRepository accommodationRepository;

	public AccommodationCancellationPolicyService(
			AccommodationCancellationPolicyRepository cancellationPolicyRepository,
			AccommodationRepository accommodationRepository
	) {
		this.cancellationPolicyRepository = cancellationPolicyRepository;
		this.accommodationRepository = accommodationRepository;
	}

	@Transactional
	public AccommodationCancellationPolicyResponse create(
			Long accommodationId,
			AccommodationCancellationPolicyRequest request
	) {
		Accommodation accommodation = getAccommodation(accommodationId);
		if (cancellationPolicyRepository.existsByAccommodationId(accommodationId)) {
			throw new BusinessException(CancellationPolicyErrorCode.ALREADY_EXISTS);
		}
		AccommodationCancellationPolicy policy = AccommodationCancellationPolicy.create(
				accommodation,
				toSnapshot(request)
		);
		return AccommodationCancellationPolicyResponse.from(cancellationPolicyRepository.save(policy));
	}

	@Transactional
	public AccommodationCancellationPolicyResponse update(
			Long accommodationId,
			AccommodationCancellationPolicyRequest request
	) {
		getAccommodation(accommodationId);
		AccommodationCancellationPolicy policy = cancellationPolicyRepository
				.findByAccommodationId(accommodationId)
				.orElseThrow(() -> new BusinessException(CancellationPolicyErrorCode.NOT_FOUND));
		policy.update(toSnapshot(request));
		return AccommodationCancellationPolicyResponse.from(policy);
	}

	@Transactional(readOnly = true)
	public CancellationPolicySnapshot resolveSnapshot(Accommodation accommodation) {
		return cancellationPolicyRepository.findByAccommodationId(accommodation.getId())
				.map(AccommodationCancellationPolicy::snapshot)
				.orElseGet(CancellationPolicySnapshot::defaultPolicy);
	}

	private CancellationPolicySnapshot toSnapshot(AccommodationCancellationPolicyRequest request) {
		return new CancellationPolicySnapshot(
				request.freeCancellationDaysBeforeCheckIn(),
				request.cancellationDeadlineDaysBeforeCheckIn(),
				request.feeRules().stream()
						.map(rule -> CancellationFeeRule.create(
								rule.minDaysBeforeCheckIn(),
								rule.feeRatePercent()
						))
						.toList()
		);
	}

	private Accommodation getAccommodation(Long accommodationId) {
		return accommodationRepository.findById(accommodationId)
				.orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND));
	}
}
