package junsik.reservation.service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
import junsik.reservation.entity.ReservationPeriod;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.MemberErrorCode;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.ReservationSpecifications;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;

@Service
public class ReservationService {

	private final ReservationRepository reservationRepository;
	private final MemberRepository memberRepository;
	private final RoomRepository roomRepository;
	private final RoomInventoryRepository roomInventoryRepository;

	public ReservationService(
			ReservationRepository reservationRepository,
			MemberRepository memberRepository,
			RoomRepository roomRepository,
			RoomInventoryRepository roomInventoryRepository
	) {
		this.reservationRepository = reservationRepository;
		this.memberRepository = memberRepository;
		this.roomRepository = roomRepository;
		this.roomInventoryRepository = roomInventoryRepository;
	}

	@Transactional
	public ReservationResponse create(Long memberId, CreateReservationRequest request) {
		validatePeriod(request.checkInDate(), request.checkOutDate());
		Member member = memberRepository.findById(memberId)
				.orElseThrow(() -> new BusinessException(MemberErrorCode.NOT_FOUND));
		Room room = roomRepository.findById(request.roomId())
				.orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
		validateOperationalStatus(room);
		validateGuestCount(room, request.guestCount());
		ReservationPeriod period = new ReservationPeriod(request.checkInDate(), request.checkOutDate());
		Map<LocalDate, RoomInventory> inventories = getInventories(room.getId(), period);
		validateAvailable(inventories.values());
		inventories.values().forEach(inventory -> inventory.reserve(1));

		Reservation reservation = Reservation.create(
				member,
				room,
				request.guestCount(),
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
		reservation.verifyCancellationAllowed();
		Map<LocalDate, RoomInventory> inventories = getInventories(
				reservation.getRoom().getId(),
				reservation.getPeriod()
		);
		validateReserved(inventories.values());
		inventories.values().forEach(inventory -> inventory.release(1));
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
		Room room = reservation.getRoom();
		validateOperationalStatus(room);
		validateGuestCount(room, reservation.getGuestCount());

		Map<LocalDate, RoomInventory> previousInventories = getInventories(
				room.getId(),
				reservation.getPeriod()
		);
		ReservationPeriod newPeriod = new ReservationPeriod(request.checkInDate(), request.checkOutDate());
		Map<LocalDate, RoomInventory> newInventories = getInventories(room.getId(), newPeriod);
		List<RoomInventory> inventoriesToRelease = previousInventories.entrySet().stream()
				.filter(entry -> !newInventories.containsKey(entry.getKey()))
				.map(Map.Entry::getValue)
				.toList();
		List<RoomInventory> inventoriesToReserve = newInventories.entrySet().stream()
				.filter(entry -> !previousInventories.containsKey(entry.getKey()))
				.map(Map.Entry::getValue)
				.toList();

		validateReserved(previousInventories.values());
		validateAvailable(inventoriesToReserve);
		inventoriesToRelease.forEach(inventory -> inventory.release(1));
		inventoriesToReserve.forEach(inventory -> inventory.reserve(1));

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

	private void validateGuestCount(Room room, int guestCount) {
		if (!room.canAccommodate(guestCount)) {
			throw new BusinessException(ReservationErrorCode.CAPACITY_EXCEEDED);
		}
	}

	private void validateOperationalStatus(Room room) {
		if (!room.getAccommodation().isActive()) {
			throw new BusinessException(AccommodationErrorCode.INACTIVE);
		}
		if (!room.isActive()) {
			throw new BusinessException(RoomErrorCode.INACTIVE);
		}
	}

	private Map<LocalDate, RoomInventory> getInventories(Long roomId, ReservationPeriod period) {
		List<RoomInventory> inventories = roomInventoryRepository
				.findAllByRoomIdAndInventoryDateGreaterThanEqualAndInventoryDateLessThanOrderByInventoryDateAsc(
						roomId,
						period.checkInDate(),
						period.checkOutDate()
				);
		List<LocalDate> inventoryDates = inventories.stream()
				.map(RoomInventory::getInventoryDate)
				.toList();
		if (!inventoryDates.equals(period.stayDates())) {
			throw new BusinessException(RoomInventoryErrorCode.NOT_FOUND);
		}

		Map<LocalDate, RoomInventory> inventoryByDate = new LinkedHashMap<>();
		inventories.forEach(inventory -> inventoryByDate.put(inventory.getInventoryDate(), inventory));
		return inventoryByDate;
	}

	private void validateAvailable(Iterable<RoomInventory> inventories) {
		for (RoomInventory inventory : inventories) {
			if (inventory.getAvailableQuantity() < 1) {
				throw new BusinessException(RoomInventoryErrorCode.INSUFFICIENT_QUANTITY);
			}
		}
	}

	private void validateReserved(Iterable<RoomInventory> inventories) {
		for (RoomInventory inventory : inventories) {
			if (inventory.getReservedQuantity() < 1) {
				throw new BusinessException(RoomInventoryErrorCode.RELEASE_EXCEEDS_RESERVED);
			}
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
