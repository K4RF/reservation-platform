package junsik.reservation.service;

import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.CreateRoomDailyPriceRequest;
import junsik.reservation.dto.RoomDailyPriceResponse;
import junsik.reservation.dto.UpdateRoomDailyPriceRequest;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomDailyPrice;
import junsik.reservation.enums.RoomDailyPriceErrorCode;
import junsik.reservation.enums.RoomErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.RoomDailyPriceRepository;
import junsik.reservation.repository.RoomRepository;

@Service
public class RoomDailyPriceService {

	private final RoomDailyPriceRepository roomDailyPriceRepository;
	private final RoomRepository roomRepository;

	public RoomDailyPriceService(
			RoomDailyPriceRepository roomDailyPriceRepository,
			RoomRepository roomRepository
	) {
		this.roomDailyPriceRepository = roomDailyPriceRepository;
		this.roomRepository = roomRepository;
	}

	@Transactional
	public RoomDailyPriceResponse create(Long roomId, CreateRoomDailyPriceRequest request) {
		Room room = getRoom(roomId);
		if (roomDailyPriceRepository.existsByRoomIdAndStayDate(roomId, request.stayDate())) {
			throw new BusinessException(RoomDailyPriceErrorCode.DUPLICATE_DATE);
		}

		RoomDailyPrice dailyPrice = RoomDailyPrice.create(
				room,
				request.stayDate(),
				request.nightlyPrice()
		);
		return RoomDailyPriceResponse.daily(roomDailyPriceRepository.save(dailyPrice));
	}

	@Transactional
	public RoomDailyPriceResponse update(
			Long roomId,
			LocalDate stayDate,
			UpdateRoomDailyPriceRequest request
	) {
		getRoom(roomId);
		RoomDailyPrice dailyPrice = roomDailyPriceRepository.findByRoomIdAndStayDate(roomId, stayDate)
				.orElseThrow(() -> new BusinessException(RoomDailyPriceErrorCode.NOT_FOUND));
		dailyPrice.changeNightlyPrice(request.nightlyPrice());
		return RoomDailyPriceResponse.daily(dailyPrice);
	}

	@Transactional(readOnly = true)
	public RoomDailyPriceResponse getEffectivePrice(Long roomId, LocalDate stayDate) {
		Room room = getRoom(roomId);
		return roomDailyPriceRepository.findByRoomIdAndStayDate(roomId, stayDate)
				.map(RoomDailyPriceResponse::daily)
				.orElseGet(() -> RoomDailyPriceResponse.fallback(room, stayDate));
	}

	private Room getRoom(Long roomId) {
		return roomRepository.findById(roomId)
				.orElseThrow(() -> new BusinessException(RoomErrorCode.NOT_FOUND));
	}
}
