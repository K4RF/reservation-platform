package junsik.reservation.service;

import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.accommodation.request.AccommodationBookingPolicyRequest;
import junsik.reservation.dto.accommodation.response.AccommodationBookingPolicyResponse;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.AccommodationBookingPolicy;
import junsik.reservation.entity.ReservationPeriod;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.BookingPolicyErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationBookingPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;

@Service
public class AccommodationBookingPolicyService {

	private final AccommodationBookingPolicyRepository bookingPolicyRepository;
	private final AccommodationRepository accommodationRepository;
	private final ReservationDateProvider dateProvider;

	public AccommodationBookingPolicyService(
			AccommodationBookingPolicyRepository bookingPolicyRepository,
			AccommodationRepository accommodationRepository,
			ReservationDateProvider dateProvider
	) {
		this.bookingPolicyRepository = bookingPolicyRepository;
		this.accommodationRepository = accommodationRepository;
		this.dateProvider = dateProvider;
	}

	@Transactional
	public AccommodationBookingPolicyResponse create(
			Long accommodationId,
			AccommodationBookingPolicyRequest request
	) {
		Accommodation accommodation = getAccommodation(accommodationId);
		if (bookingPolicyRepository.existsByAccommodationId(accommodationId)) {
			throw new BusinessException(BookingPolicyErrorCode.ALREADY_EXISTS);
		}
		AccommodationBookingPolicy policy = AccommodationBookingPolicy.create(
				accommodation,
				request.minStayNights(),
				request.maxStayNights(),
				request.minAdvanceBookingDays(),
				request.maxAdvanceBookingDays()
		);
		return AccommodationBookingPolicyResponse.from(bookingPolicyRepository.save(policy));
	}

	@Transactional
	public AccommodationBookingPolicyResponse update(
			Long accommodationId,
			AccommodationBookingPolicyRequest request
	) {
		getAccommodation(accommodationId);
		AccommodationBookingPolicy policy = bookingPolicyRepository.findByAccommodationId(accommodationId)
				.orElseThrow(() -> new BusinessException(BookingPolicyErrorCode.NOT_FOUND));
		policy.update(
				request.minStayNights(),
				request.maxStayNights(),
				request.minAdvanceBookingDays(),
				request.maxAdvanceBookingDays()
		);
		return AccommodationBookingPolicyResponse.from(policy);
	}

	@Transactional(readOnly = true)
	public void validateReservationPeriod(Accommodation accommodation, ReservationPeriod period) {
		bookingPolicyRepository.findByAccommodationId(accommodation.getId())
				.ifPresent(policy -> policy.validateReservationPeriod(
						dateProvider.today(accommodation.getZoneId()),
						period
				));
	}

	public LocalDate today(ZoneId zoneId) {
		return dateProvider.today(zoneId);
	}

	private Accommodation getAccommodation(Long accommodationId) {
		return accommodationRepository.findById(accommodationId)
				.orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND));
	}
}
