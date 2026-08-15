package junsik.reservation.service;

import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.CreateReservationRequest;
import junsik.reservation.dto.ReservationResponse;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.MemberErrorCode;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
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

	private void validatePeriod(LocalDate checkInDate, LocalDate checkOutDate) {
		if (!checkInDate.isBefore(checkOutDate)) {
			throw new BusinessException(ReservationErrorCode.INVALID_PERIOD);
		}
	}
}
