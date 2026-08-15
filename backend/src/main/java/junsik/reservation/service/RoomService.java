package junsik.reservation.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.CreateRoomRequest;
import junsik.reservation.dto.PageResponse;
import junsik.reservation.dto.RoomResponse;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.AccommodationErrorCode;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;

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
		Room room = Room.create(accommodation, request.name().trim(), request.capacity());
		return RoomResponse.from(roomRepository.save(room));
	}

	@Transactional(readOnly = true)
	public RoomResponse getById(Long roomId) {
		return roomRepository.findById(roomId)
				.map(RoomResponse::from)
				.orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
	}

	@Transactional(readOnly = true)
	public PageResponse<RoomResponse> getAllByAccommodation(Long accommodationId, int page, int size) {
		if (!accommodationRepository.existsById(accommodationId)) {
			throw new BusinessException(AccommodationErrorCode.NOT_FOUND);
		}

		PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "id"));
		Page<RoomResponse> rooms = roomRepository
				.findAllByAccommodationId(accommodationId, pageRequest)
				.map(RoomResponse::from);
		return PageResponse.from(rooms);
	}

	private Accommodation getAccommodation(Long accommodationId) {
		return accommodationRepository.findById(accommodationId)
				.orElseThrow(() -> new BusinessException(AccommodationErrorCode.NOT_FOUND));
	}
}
