package junsik.reservation.performance;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.accommodation.AccommodationBookingPolicy;
import junsik.reservation.entity.room.Room;
import junsik.reservation.entity.room.RoomDailyPrice;
import junsik.reservation.entity.room.RoomInventory;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.repository.AccommodationBookingPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomDailyPriceRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;

final class ReadApiPerformanceFixture {

	static final int ACCOMMODATION_COUNT = 10;
	static final int ROOMS_PER_ACCOMMODATION = 5;
	static final int STAY_NIGHTS = 3;
	static final LocalDate CHECK_IN_DATE = LocalDate.of(2035, 5, 10);
	static final LocalDate CHECK_OUT_DATE = CHECK_IN_DATE.plusDays(STAY_NIGHTS);

	private final AccommodationRepository accommodationRepository;
	private final AccommodationBookingPolicyRepository bookingPolicyRepository;
	private final RoomRepository roomRepository;
	private final RoomInventoryRepository roomInventoryRepository;
	private final RoomDailyPriceRepository roomDailyPriceRepository;

	ReadApiPerformanceFixture(
			AccommodationRepository accommodationRepository,
			AccommodationBookingPolicyRepository bookingPolicyRepository,
			RoomRepository roomRepository,
			RoomInventoryRepository roomInventoryRepository,
			RoomDailyPriceRepository roomDailyPriceRepository
	) {
		this.accommodationRepository = accommodationRepository;
		this.bookingPolicyRepository = bookingPolicyRepository;
		this.roomRepository = roomRepository;
		this.roomInventoryRepository = roomInventoryRepository;
		this.roomDailyPriceRepository = roomDailyPriceRepository;
	}

	Fixture create(String fixtureNamePrefix) {
		List<Room> rooms = new ArrayList<>();
		List<RoomInventory> inventories = new ArrayList<>();
		List<RoomDailyPrice> dailyPrices = new ArrayList<>();

		for (int accommodationIndex = 0; accommodationIndex < ACCOMMODATION_COUNT; accommodationIndex++) {
			Accommodation accommodation = accommodationRepository.saveAndFlush(Accommodation.create(
					fixtureNamePrefix + " " + accommodationIndex,
					"Reproducible query performance fixture",
					"KR",
					"Seoul",
					"Gangnam",
					"Baseline address " + accommodationIndex,
					Set.of(AccommodationAmenity.PARKING, AccommodationAmenity.BREAKFAST),
					LocalTime.of(15, 0),
					LocalTime.of(11, 0),
					"Asia/Seoul"
			));
			bookingPolicyRepository.save(AccommodationBookingPolicy.create(
					accommodation,
					1,
					30,
					0,
					10_000
			));
			for (int roomIndex = 0; roomIndex < ROOMS_PER_ACCOMMODATION; roomIndex++) {
				rooms.add(Room.create(
						accommodation,
						"Baseline Room " + accommodationIndex + "-" + roomIndex,
						4,
						new BigDecimal("100000.00").add(BigDecimal.valueOf(roomIndex * 1000L)),
						Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER)
				));
			}
		}
		bookingPolicyRepository.flush();
		roomRepository.saveAllAndFlush(rooms);
		for (Room room : rooms) {
			CHECK_IN_DATE.datesUntil(CHECK_OUT_DATE)
					.map(date -> RoomInventory.create(room, date, 3))
					.forEach(inventories::add);
			dailyPrices.add(RoomDailyPrice.create(
					room,
					CHECK_IN_DATE,
					new BigDecimal("120000.00")
			));
		}
		roomInventoryRepository.saveAllAndFlush(inventories);
		roomDailyPriceRepository.saveAllAndFlush(dailyPrices);
		return new Fixture(rooms.getFirst().getAccommodation().getId(), rooms.getFirst().getId());
	}

	record Fixture(Long accommodationId, Long roomId) {
	}
}
