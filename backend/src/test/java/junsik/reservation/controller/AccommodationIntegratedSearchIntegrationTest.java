package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomFixture.room;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.AccommodationBookingPolicy;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.RoomInventorySaleStatus;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.AccommodationBookingPolicyRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccommodationIntegratedSearchIntegrationTest {

	private static final String SEARCH_URL = "/api/v1/accommodations";
	private static final LocalDate CHECK_IN = LocalDate.of(2030, 8, 10);
	private static final LocalDate CHECK_OUT = LocalDate.of(2030, 8, 13);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private AccommodationBookingPolicyRepository bookingPolicyRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void searchesNameAndRegionCaseInsensitively() throws Exception {
		Accommodation expected = saveAccommodation("Ocean HOTEL", "부산 해운대구 달맞이길");
		saveAccommodation("Ocean Hotel", "제주 서귀포시");
		saveAccommodation("Mountain Lodge", "부산 해운대구");

		performSearch("name", " hotel ", "region", " 해운대 ")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(expected.getId()));
	}

	@Test
	void filtersByActiveRoomCapacityAndBaseNightlyPrice() throws Exception {
		Accommodation expected = saveAccommodation("Family Hotel", "서울 중구");
		Accommodation tooSmall = saveAccommodation("Small Hotel", "서울 중구");
		Accommodation tooExpensive = saveAccommodation("Luxury Hotel", "서울 중구");
		Accommodation inactiveRoomOnly = saveAccommodation("Closed Room Hotel", "서울 중구");
		saveRoom(expected, "Family Room", 4, "150000.00", RoomStatus.ACTIVE);
		saveRoom(tooSmall, "Double Room", 2, "150000.00", RoomStatus.ACTIVE);
		saveRoom(tooExpensive, "Suite", 4, "350000.00", RoomStatus.ACTIVE);
		saveRoom(inactiveRoomOnly, "Inactive Family Room", 4, "150000.00", RoomStatus.INACTIVE);

		performSearch(
				"guestCount", "3",
				"minPrice", "100000",
				"maxPrice", "200000"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(expected.getId()));
	}

	@Test
	void datesDefaultToAvailableSearchAndRequireInventoryForEveryStayDate() throws Exception {
		Accommodation expected = saveAccommodation("Available Hotel", "서울 종로구");
		Accommodation soldOut = saveAccommodation("Sold Out Hotel", "서울 종로구");
		Accommodation missingInventory = saveAccommodation("Missing Inventory Hotel", "서울 종로구");
		Accommodation closedInventory = saveAccommodation("Closed Inventory Hotel", "서울 종로구");
		Room availableRoom = saveRoom(expected, "Available Room", 2, "100000.00", RoomStatus.ACTIVE);
		Room soldOutRoom = saveRoom(soldOut, "Sold Out Room", 2, "100000.00", RoomStatus.ACTIVE);
		Room missingRoom = saveRoom(missingInventory, "Missing Room", 2, "100000.00", RoomStatus.ACTIVE);
		Room closedRoom = saveRoom(closedInventory, "Closed Room", 2, "100000.00", RoomStatus.ACTIVE);
		saveInventory(availableRoom, CHECK_IN, CHECK_OUT, false);
		saveInventory(soldOutRoom, CHECK_IN, CHECK_OUT, false);
		roomInventoryRepository.findByRoomIdAndInventoryDate(soldOutRoom.getId(), CHECK_IN.plusDays(1))
				.orElseThrow()
				.reserve(1);
		saveInventory(missingRoom, CHECK_IN, CHECK_OUT.minusDays(1), false);
		saveInventory(closedRoom, CHECK_IN, CHECK_OUT, false);
		roomInventoryRepository.findByRoomIdAndInventoryDate(closedRoom.getId(), CHECK_IN.plusDays(1))
				.orElseThrow()
				.update(1, RoomInventorySaleStatus.CLOSED);

		performSearch(
				"checkInDate", CHECK_IN.toString(),
				"checkOutDate", CHECK_OUT.toString(),
				"guestCount", "2"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(expected.getId()));
	}

	@Test
	void excludesAccommodationWhenStayPeriodViolatesItsBookingPolicy() throws Exception {
		Accommodation allowed = saveAccommodation("Flexible Hotel", "서울 종로구");
		Accommodation blocked = saveAccommodation("Long Stay Hotel", "서울 종로구");
		Room allowedRoom = saveRoom(allowed, "Flexible Room", 2, "100000.00", RoomStatus.ACTIVE);
		Room blockedRoom = saveRoom(blocked, "Long Stay Room", 2, "100000.00", RoomStatus.ACTIVE);
		saveInventory(allowedRoom, CHECK_IN, CHECK_OUT, false);
		saveInventory(blockedRoom, CHECK_IN, CHECK_OUT, false);
		bookingPolicyRepository.saveAndFlush(AccommodationBookingPolicy.create(
				blocked,
				4,
				10,
				0,
				10_000
		));

		performSearch(
				"checkInDate", CHECK_IN.toString(),
				"checkOutDate", CHECK_OUT.toString(),
				"available", "true"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(allowed.getId()));

		performSearch(
				"checkInDate", CHECK_IN.toString(),
				"checkOutDate", CHECK_OUT.toString(),
				"available", "false"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(blocked.getId()));
	}

	@Test
	void findsUnavailableAccommodationWhenRequested() throws Exception {
		Accommodation available = saveAccommodation("Available Hotel", "제주 제주시");
		Accommodation unavailable = saveAccommodation("Unavailable Hotel", "제주 제주시");
		Room availableRoom = saveRoom(available, "Available Room", 2, "120000.00", RoomStatus.ACTIVE);
		Room unavailableRoom = saveRoom(unavailable, "Unavailable Room", 2, "120000.00", RoomStatus.ACTIVE);
		saveInventory(availableRoom, CHECK_IN, CHECK_OUT, false);
		saveInventory(unavailableRoom, CHECK_IN, CHECK_OUT, true);

		performSearch(
				"region", "제주",
				"checkInDate", CHECK_IN.toString(),
				"checkOutDate", CHECK_OUT.toString(),
				"guestCount", "2",
				"available", "false"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(unavailable.getId()));
	}

	@Test
	void combinesAllSearchConditions() throws Exception {
		Accommodation expected = saveAccommodation("Seoul Stay", "서울 강남구");
		Accommodation wrongStatus = saveAccommodation("Seoul Residence", "서울 강남구");
		Accommodation wrongPrice = saveAccommodation("Seoul House", "서울 강남구");
		wrongStatus.changeStatus(AccommodationStatus.INACTIVE);
		Room expectedRoom = saveRoom(expected, "Family", 4, "180000.00", RoomStatus.ACTIVE);
		Room inactiveAccommodationRoom = saveRoom(
				wrongStatus,
				"Family",
				4,
				"180000.00",
				RoomStatus.ACTIVE
		);
		Room expensiveRoom = saveRoom(wrongPrice, "Family", 4, "280000.00", RoomStatus.ACTIVE);
		saveInventory(expectedRoom, CHECK_IN, CHECK_OUT, false);
		saveInventory(inactiveAccommodationRoom, CHECK_IN, CHECK_OUT, false);
		saveInventory(expensiveRoom, CHECK_IN, CHECK_OUT, false);

		performSearch(
				"name", "Seoul",
				"region", "강남",
				"checkInDate", CHECK_IN.toString(),
				"checkOutDate", CHECK_OUT.toString(),
				"guestCount", "3",
				"minPrice", "150000",
				"maxPrice", "200000",
				"status", "ACTIVE",
				"available", "true"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(expected.getId()));
	}

	@Test
	void searchesStructuredLocationAndAllAccommodationAndRoomAmenities() throws Exception {
		Accommodation expected = saveStructuredAccommodation(
				"Complete Seoul Hotel",
				"서울특별시",
				"강남구",
				Set.of(AccommodationAmenity.PARKING, AccommodationAmenity.POOL)
		);
		Accommodation missingAccommodationAmenity = saveStructuredAccommodation(
				"No Pool Hotel",
				"서울특별시",
				"강남구",
				Set.of(AccommodationAmenity.PARKING)
		);
		Accommodation wrongCity = saveStructuredAccommodation(
				"Busan Hotel",
				"부산광역시",
				"해운대구",
				Set.of(AccommodationAmenity.PARKING, AccommodationAmenity.POOL)
		);
		Room expectedRoom = roomRepository.saveAndFlush(Room.create(
				expected,
				"Complete Room",
				4,
				new BigDecimal("180000.00"),
				Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER)
		));
		roomRepository.saveAndFlush(Room.create(
				missingAccommodationAmenity,
				"Complete Room",
				4,
				new BigDecimal("180000.00"),
				Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER)
		));
		roomRepository.saveAndFlush(Room.create(
				wrongCity,
				"Complete Room",
				4,
				new BigDecimal("180000.00"),
				Set.of(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER)
		));
		roomRepository.saveAndFlush(Room.create(
				expected,
				"Wifi Only Room",
				4,
				new BigDecimal("170000.00"),
				Set.of(RoomAmenity.WIFI)
		));

		performSearch(
				"city", " 서울특별시 ",
				"region", " 강남구 ",
				"accommodationAmenities", "PARKING",
				"accommodationAmenities", "POOL",
				"roomAmenities", "WIFI",
				"roomAmenities", "AIR_CONDITIONER"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(expected.getId()))
				.andExpect(jsonPath("$.content[0].city").value("서울특별시"))
				.andExpect(jsonPath("$.content[0].region").value("강남구"));

		org.assertj.core.api.Assertions.assertThat(expectedRoom.getAmenities())
				.containsExactlyInAnyOrder(RoomAmenity.WIFI, RoomAmenity.AIR_CONDITIONER);
	}

	@Test
	void returnsEmptyPageWhenNoAccommodationMatches() throws Exception {
		saveAccommodation("Ocean Hotel", "부산 해운대구");

		performSearch("region", "서울")
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0))
				.andExpect(jsonPath("$.totalElements").value(0));
	}

	@Test
	void paginatesAndAppliesOnlyAllowedSortFields() throws Exception {
		saveAccommodation("Bravo Hotel", "서울");
		saveAccommodation("Alpha Hotel", "서울");
		saveAccommodation("Charlie Hotel", "서울");

		performSearch(
				"region", "서울",
				"sortBy", "NAME",
				"direction", "ASC",
				"page", "1",
				"size", "1"
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].name").value("Bravo Hotel"))
				.andExpect(jsonPath("$.page").value(1))
				.andExpect(jsonPath("$.totalElements").value(3))
				.andExpect(jsonPath("$.totalPages").value(3));

		performSearch("sortBy", "ADDRESS")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void rejectsInvalidPeriodPriceRangeAndAvailabilityWithoutPeriod() throws Exception {
		performSearch("checkInDate", CHECK_IN.toString())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_003"));

		performSearch(
				"checkInDate", CHECK_OUT.toString(),
				"checkOutDate", CHECK_IN.toString()
		)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_003"));

		performSearch("minPrice", "200000", "maxPrice", "100000")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_004"));

		performSearch("available", "true")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_005"));
	}

	private ResultActions performSearch(String... parameters) throws Exception {
		var request = get(SEARCH_URL).header("Authorization", bearerToken());
		for (int index = 0; index < parameters.length; index += 2) {
			request.param(parameters[index], parameters[index + 1]);
		}
		return mockMvc.perform(request);
	}

	private Accommodation saveAccommodation(String name, String address) {
		return accommodationRepository.saveAndFlush(accommodation(name, "Description", address));
	}

	private Accommodation saveStructuredAccommodation(
			String name,
			String city,
			String region,
			Set<AccommodationAmenity> amenities
	) {
		return accommodationRepository.saveAndFlush(Accommodation.create(
				name,
				"Description",
				"대한민국",
				city,
				region,
				"테스트 상세 주소",
				amenities
		));
	}

	private Room saveRoom(
			Accommodation accommodation,
			String name,
			int capacity,
			String nightlyPrice,
			RoomStatus status
	) {
		Room room = roomRepository.saveAndFlush(room(
				accommodation,
				name,
				capacity,
				new BigDecimal(nightlyPrice)
		));
		room.changeStatus(status);
		roomRepository.flush();
		return room;
	}

	private void saveInventory(Room room, LocalDate startDate, LocalDate endDate, boolean soldOut) {
		startDate.datesUntil(endDate).forEach(date -> {
			RoomInventory inventory = RoomInventory.create(room, date, 1);
			if (soldOut) {
				inventory.reserve(1);
			}
			roomInventoryRepository.save(inventory);
		});
		roomInventoryRepository.flush();
	}

	private String bearerToken() {
		return junsik.reservation.support.AuthenticationTestSupport.bearerToken(
				jwtTokenProvider,
				MemberRole.USER
		);
	}
}
