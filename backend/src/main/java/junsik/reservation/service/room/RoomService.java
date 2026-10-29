package junsik.reservation.service.room;

import java.util.List;
import java.util.Map;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.config.RedisCacheConfig;
import junsik.reservation.dto.common.response.PageResponse;
import junsik.reservation.dto.media.response.MediaResponse;
import junsik.reservation.dto.room.request.AvailableRoomRequest;
import junsik.reservation.dto.room.request.CreateRoomRequest;
import junsik.reservation.dto.room.request.RoomSearchRequest;
import junsik.reservation.dto.room.request.UpdateRoomRequest;
import junsik.reservation.dto.room.request.UpdateRoomStatusRequest;
import junsik.reservation.dto.room.response.RoomResponse;
import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.reservation.ReservationPeriod;
import junsik.reservation.entity.room.Room;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.enums.RoomInventorySaleStatus;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.repository.RoomSpecifications;
import junsik.reservation.service.accommodation.AccommodationBookingPolicyService;
import junsik.reservation.service.media.CatalogMediaReadService;

@Service
public class RoomService {

	private final RoomRepository roomRepository;
	private final AccommodationRepository accommodationRepository;
	private final AccommodationBookingPolicyService bookingPolicyService;
	private final CatalogMediaReadService mediaService;

	public RoomService(
			RoomRepository roomRepository,
			AccommodationRepository accommodationRepository,
			AccommodationBookingPolicyService bookingPolicyService,
			CatalogMediaReadService mediaService
	) {
		this.roomRepository = roomRepository;
		this.accommodationRepository = accommodationRepository;
		this.bookingPolicyService = bookingPolicyService;
		this.mediaService = mediaService;
	}

	@Transactional
	public RoomResponse create(Long accommodationId, CreateRoomRequest request) {
		Accommodation accommodation = getAccommodation(accommodationId);
		Room room = Room.create(
				accommodation,
				request.name().trim(),
				request.capacity(),
				request.nightlyPrice(),
				request.amenities()
		);
		return RoomResponse.from(roomRepository.save(room));
	}

	@Transactional(readOnly = true)
	@Cacheable(cacheNames = RedisCacheConfig.ROOM_DETAIL_CACHE, key = "#p0", sync = true)
	public RoomResponse getById(Long roomId) {
		return detailResponse(getRoom(roomId));
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
		Page<Room> rooms = roomRepository
				.findAll(RoomSpecifications.withFilters(
						accommodationId,
						request.minCapacity(),
						request.minPrice(),
						request.maxPrice(),
						request.status(),
						request.amenities()
				), pageRequest);
		return listResponse(rooms);
	}

	@Transactional(readOnly = true)
	public PageResponse<RoomResponse> getAvailableRooms(
			Long accommodationId,
			AvailableRoomRequest request,
			int page,
			int size
	) {
		validatePeriod(request);
		Accommodation accommodation = getAccommodation(accommodationId);
		ReservationPeriod period = new ReservationPeriod(request.checkInDate(), request.checkOutDate());
		bookingPolicyService.validateReservationPeriod(accommodation, period);

		PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "id"));
		Page<Room> rooms = roomRepository.findAvailableRooms(
				accommodationId,
				AccommodationStatus.ACTIVE,
				RoomStatus.ACTIVE,
				RoomInventorySaleStatus.OPEN,
				request.checkInDate(),
				request.checkOutDate(),
				request.guestCount(),
				period.stayNights(),
				pageRequest
		);
		return listResponse(rooms);
	}

	@Transactional
	@CacheEvict(
			cacheNames = RedisCacheConfig.ROOM_DETAIL_CACHE,
			key = "#p0",
			beforeInvocation = false
	)
	public RoomResponse update(Long roomId, UpdateRoomRequest request) {
		Room room = getRoom(roomId);
		room.update(
				request.name().trim(),
				request.capacity(),
				request.nightlyPrice(),
				request.amenities()
		);
		return detailResponse(room);
	}

	@Transactional
	@CacheEvict(
			cacheNames = RedisCacheConfig.ROOM_DETAIL_CACHE,
			key = "#p0",
			beforeInvocation = false
	)
	public RoomResponse updateStatus(Long roomId, UpdateRoomStatusRequest request) {
		Room room = getRoom(roomId);
		room.changeStatus(request.status());
		return detailResponse(room);
	}

	private RoomResponse detailResponse(Room room) {
		List<MediaResponse> images = mediaService.roomImages(
				List.of(room.getId()), CatalogMediaReadService.GALLERY_LIMIT).getOrDefault(room.getId(), List.of());
		return RoomResponse.from(room, images);
	}

	private PageResponse<RoomResponse> listResponse(Page<Room> rooms) {
		Map<Long, List<MediaResponse>> images = mediaService.roomImages(
				rooms.getContent().stream().map(Room::getId).toList(), 1);
		return PageResponse.from(rooms.map(room -> RoomResponse.from(
				room, images.getOrDefault(room.getId(), List.of()))));
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
