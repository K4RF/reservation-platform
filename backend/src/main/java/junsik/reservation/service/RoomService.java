package junsik.reservation.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.AvailableRoomRequest;
import junsik.reservation.dto.CreateRoomRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.RoomResponse;
import junsik.reservation.dto.RoomSearchRequest;
import junsik.reservation.dto.UpdateRoomRequest;
import junsik.reservation.dto.UpdateRoomStatusRequest;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.ReservationPeriod;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.repository.RoomSpecifications;

@Service
public class RoomService {

	private final RoomRepository roomRepository;
	private final AccommodationRepository accommodationRepository;

	public RoomService(RoomRepository roomRepository, AccommodationRepository accommodationRepository) {
		this.roomRepository = roomRepository;
		this.accommodationRepository = accommodationRepository;
	}

	@Transactional
	public RoomResponse create(Long accommodationId, CreateRoomRequest request) {
		Accommodation accommodation = getAccommodation(accommodationId);
		Room room = Room.create(
				accommodation,
				request.name().trim(),
				request.capacity(),
				request.nightlyPrice()
		);
		return RoomResponse.from(roomRepository.save(room));
	}

	@Transactional(readOnly = true)
	public RoomResponse getById(Long roomId) {
		return roomRepository.findById(roomId)
				.map(RoomResponse::from)
				.orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
	}

	@Transactional(readOnly = true)
	public PageResponse<RoomResponse> getAllByAccommodation(Long accommodationId, RoomSearchRequest request) {
		if (!accommodationRepository.existsById(accommodationId)) {
			throw new BusinessException(AccommodationErrorCode.NOT_FOUND);
		}
		validatePriceRange(request);

		Sort sort = Sort.by(request.direction().toSpringDirection(), request.sortBy().getProperty())
				.and(Sort.by(Sort.Direction.ASC, "id"));
		PageRequest pageRequest = PageRequest.of(request.page(), request.size(), sort);
		Page<RoomResponse> rooms = roomRepository
				.findAll(RoomSpecifications.withFilters(
						accommodationId,
						request.minCapacity(),
						request.minPrice(),
						request.maxPrice(),
						request.status()
				), pageRequest)
				.map(RoomResponse::from);
		return PageResponse.from(rooms);
	}

	@Transactional(readOnly = true)
	public PageResponse<RoomResponse> getAvailableRooms(
			Long accommodationId,
			AvailableRoomRequest request,
			int page,
			int size
	) {
		validatePeriod(request);
		if (!accommodationRepository.existsById(accommodationId)) {
			throw new BusinessException(AccommodationErrorCode.NOT_FOUND);
		}

		PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "id"));
		Page<RoomResponse> rooms = roomRepository.findAvailableRooms(
				accommodationId,
				AccommodationStatus.ACTIVE,
				RoomStatus.ACTIVE,
				request.checkInDate(),
				request.checkOutDate(),
				request.guestCount(),
				new ReservationPeriod(request.checkInDate(), request.checkOutDate()).stayNights(),
				pageRequest
		).map(RoomResponse::from);
		return PageResponse.from(rooms);
	}

	@Transactional
	public RoomResponse update(Long roomId, UpdateRoomRequest request) {
		Room room = getRoom(roomId);
		room.update(request.name().trim(), request.capacity(), request.nightlyPrice());
		return RoomResponse.from(room);
	}

	@Transactional
	public RoomResponse updateStatus(Long roomId, UpdateRoomStatusRequest request) {
		Room room = getRoom(roomId);
		room.changeStatus(request.status());
		return RoomResponse.from(room);
	}

	private void validatePeriod(AvailableRoomRequest request) {
		if (!request.checkInDate().isBefore(request.checkOutDate())) {
			throw new BusinessException(RoomErrorCode.INVALID_PERIOD);
		}
	}

	private void validatePriceRange(RoomSearchRequest request) {
		if (request.minPrice() != null
				&& request.maxPrice() != null
				&& request.minPrice().compareTo(request.maxPrice()) > 0) {
			throw new BusinessException(RoomErrorCode.INVALID_PRICE_RANGE);
		}
	}

	private Accommodation getAccommodation(Long accommodationId) {
		return accommodationRepository.findById(accommodationId)
				.orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND));
	}

	private Room getRoom(Long roomId) {
		return roomRepository.findById(roomId)
				.orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
	}
}
