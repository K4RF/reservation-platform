package junsik.reservation.service;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.CreateReservationRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.ReservationResponse;
import junsik.reservation.dto.ReservationSearchRequest;
import junsik.reservation.dto.UpdateReservationScheduleRequest;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.MemberErrorCode;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.ReservationSpecifications;
import junsik.reservation.repository.RoomRepository;

@Service
public class ReservationService {

	private final ReservationRepository reservationRepository;
	private final MemberRepository memberRepository;
	private final RoomRepository roomRepository;

	public ReservationService(
			ReservationRepository reservationRepository,
			MemberRepository memberRepository,
			RoomRepository roomRepository
	) {
		this.reservationRepository = reservationRepository;
		this.memberRepository = memberRepository;
		this.roomRepository = roomRepository;
	}

	@Transactional
	public ReservationResponse create(Long memberId, CreateReservationRequest request) {
		validatePeriod(request.checkInDate(), request.checkOutDate());
		Member member = memberRepository.findById(memberId)
				.orElseThrow(() -> new BusinessException(MemberErrorCode.NOT_FOUND));
		Room room = roomRepository.findById(request.roomId())
				.orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
		if (!room.getAccommodation().isActive()) {
			throw new BusinessException(AccommodationErrorCode.INACTIVE);
		}
		if (!room.isActive()) {
			throw new BusinessException(RoomErrorCode.INACTIVE);
		}

		boolean overlaps = reservationRepository
				.existsByRoomIdAndStatusAndCheckInDateLessThanAndCheckOutDateGreaterThan(
						room.getId(),
						ReservationStatus.CONFIRMED,
						request.checkOutDate(),
						request.checkInDate()
				);
		if (overlaps) {
			throw new BusinessException(ReservationErrorCode.PERIOD_OVERLAP);
		}

		Reservation reservation = Reservation.create(
				member,
				room,
				request.checkInDate(),
				request.checkOutDate()
		);
		return ReservationResponse.from(reservationRepository.save(reservation));
	}

	@Transactional(readOnly = true)
	public ReservationResponse getById(Long memberId, Long reservationId) {
		Reservation reservation = getReservation(reservationId);
		validateOwner(reservation, memberId);
		return ReservationResponse.from(reservation);
	}

	@Transactional(readOnly = true)
	public PageResponse<ReservationResponse> getAllByMember(Long memberId, ReservationSearchRequest request) {
		validateSearchPeriod(request);

		Sort sort = Sort.by(request.direction().toSpringDirection(), request.sortBy().getProperty());
		if (!"id".equals(request.sortBy().getProperty())) {
			sort = sort.and(Sort.by(Sort.Direction.ASC, "id"));
		}
		PageRequest pageRequest = PageRequest.of(request.page(), request.size(), sort);
		Page<ReservationResponse> reservations = reservationRepository
				.findAll(ReservationSpecifications.withFilters(
						memberId,
						request.status(),
						request.checkInFrom(),
						request.checkInTo(),
						request.checkOutFrom(),
						request.checkOutTo()
				), pageRequest)
				.map(ReservationResponse::from);
		return PageResponse.from(reservations);
	}

	@Transactional
	public ReservationResponse cancel(Long memberId, Long reservationId) {
		Reservation reservation = getReservation(reservationId);
		validateOwner(reservation, memberId);
		reservation.cancel();
		return ReservationResponse.from(reservation);
	}

	@Transactional
	public ReservationResponse updateSchedule(
			Long memberId,
			Long reservationId,
			UpdateReservationScheduleRequest request
	) {
		Reservation reservation = getReservation(reservationId);
		validateOwner(reservation, memberId);
		reservation.verifyScheduleChangeAllowed();
		validatePeriod(request.checkInDate(), request.checkOutDate());

		boolean overlaps = reservationRepository
				.existsByRoomIdAndStatusAndIdNotAndCheckInDateLessThanAndCheckOutDateGreaterThan(
						reservation.getRoom().getId(),
						ReservationStatus.CONFIRMED,
						reservation.getId(),
						request.checkOutDate(),
						request.checkInDate()
				);
		if (overlaps) {
			throw new BusinessException(ReservationErrorCode.PERIOD_OVERLAP);
		}

		reservation.changeSchedule(request.checkInDate(), request.checkOutDate());
		return ReservationResponse.from(reservation);
	}

	private Reservation getReservation(Long reservationId) {
		return reservationRepository.findById(reservationId)
				.orElseThrow(() -> new BusinessException(ReservationErrorCode.NOT_FOUND));
	}

	private void validateOwner(Reservation reservation, Long memberId) {
		if (!reservation.getMember().getId().equals(memberId)) {
			throw new BusinessException(ReservationErrorCode.ACCESS_DENIED);
		}
	}

	private void validatePeriod(LocalDate checkInDate, LocalDate checkOutDate) {
		if (!checkInDate.isBefore(checkOutDate)) {
			throw new BusinessException(ReservationErrorCode.INVALID_PERIOD);
		}
	}

	private void validateSearchPeriod(ReservationSearchRequest request) {
		if (isReversed(request.checkInFrom(), request.checkInTo())
				|| isReversed(request.checkOutFrom(), request.checkOutTo())) {
			throw new BusinessException(ReservationErrorCode.INVALID_SEARCH_PERIOD);
		}
	}

	private boolean isReversed(LocalDate from, LocalDate to) {
		return from != null && to != null && from.isAfter(to);
	}
}
