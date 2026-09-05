package junsik.reservation.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomFixture.room;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AvailableRoomIntegrationTest {

	private static final LocalDate CHECK_IN = LocalDate.of(2030, 1, 10);
	private static final LocalDate CHECK_OUT = LocalDate.of(2030, 1, 15);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void returnsOnlyActiveAvailableRoomsForCapacityWithPagination() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		Accommodation otherAccommodation = saveAccommodation("Mountain Hotel");
		Room firstAvailable = saveRoom(accommodation, "Available Twin", 2);
		Room secondAvailable = saveRoom(accommodation, "Remaining Inventory Room", 4);
		Room tooSmall = saveRoom(accommodation, "Single Room", 1);
		Room reserved = saveRoom(accommodation, "Reserved Suite", 4);
		Room inactive = saveRoom(accommodation, "Inactive Room", 4);
		Room other = saveRoom(otherAccommodation, "Other Accommodation Room", 4);

		saveInventory(firstAvailable, CHECK_IN, CHECK_OUT, 1, 0);
		saveInventory(secondAvailable, CHECK_IN, CHECK_OUT, 2, 1);
		saveInventory(tooSmall, CHECK_IN, CHECK_OUT, 1, 0);
		saveInventory(reserved, CHECK_IN, CHECK_OUT, 1, 1);
		saveInventory(inactive, CHECK_IN, CHECK_OUT, 1, 0);
		saveInventory(other, CHECK_IN, CHECK_OUT, 1, 0);
		jdbcTemplate.update("update rooms set status = 'INACTIVE' where id = ?", inactive.getId());

		performAvailable(accommodation.getId(), CHECK_IN, CHECK_OUT, 2, 0, 1)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].roomId").value(firstAvailable.getId()))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(1))
				.andExpect(jsonPath("$.totalElements").value(2))
				.andExpect(jsonPath("$.totalPages").value(2))
				.andExpect(jsonPath("$.first").value(true))
				.andExpect(jsonPath("$.last").value(false));

		performAvailable(accommodation.getId(), CHECK_IN, CHECK_OUT, 2, 1, 1)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].roomId").value(secondAvailable.getId()))
				.andExpect(jsonPath("$.last").value(true));
	}

	@Test
	void includesRoomWhenRequestedCheckInMatchesExistingCheckout() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		Room room = saveRoom(accommodation, "Boundary Room", 2);
		saveInventory(room, CHECK_IN, CHECK_OUT, 1, 1);
		saveInventory(room, CHECK_OUT, CHECK_OUT.plusDays(3), 1, 0);

		performAvailable(accommodation.getId(), CHECK_OUT, CHECK_OUT.plusDays(3), 2, 0, 20)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].roomId").value(room.getId()));
	}

	@Test
	void excludesRoomsWhenAccommodationIsInactive() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		Room room = saveRoom(accommodation, "Available Room", 2);
		saveInventory(room, CHECK_IN, CHECK_OUT, 1, 0);
		accommodation.changeStatus(AccommodationStatus.INACTIVE);
		accommodationRepository.flush();

		performAvailable(accommodation.getId(), CHECK_IN, CHECK_OUT, 2, 0, 20)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0))
				.andExpect(jsonPath("$.totalElements").value(0));
	}

	@Test
	void rejectsSameOrReversedPeriod() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");

		performAvailable(accommodation.getId(), CHECK_IN, CHECK_IN, 1, 0, 20)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ROOM_002"));

		performAvailable(accommodation.getId(), CHECK_OUT, CHECK_IN, 1, 0, 20)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ROOM_002"));
	}

	@Test
	void rejectsInvalidGuestCountAndMissingDates() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");

		performAvailable(accommodation.getId(), CHECK_IN, CHECK_OUT, 0, 0, 20)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));

		mockMvc.perform(get(availableRoomsUrl(accommodation.getId()))
					.header("Authorization", bearerToken())
					.param("guestCount", "2"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void returnsNotFoundForUnknownAccommodation() throws Exception {
		performAvailable(999999L, CHECK_IN, CHECK_OUT, 1, 0, 20)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"));
	}

	@Test
	void rejectsAvailableRoomQueryWithoutAuthentication() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");

		mockMvc.perform(get(availableRoomsUrl(accommodation.getId()))
					.param("checkInDate", CHECK_IN.toString())
					.param("checkOutDate", CHECK_OUT.toString())
					.param("guestCount", "2"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_001"));
	}

	private ResultActions performAvailable(
			Long accommodationId,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			int guestCount,
			int page,
			int size
	) throws Exception {
		return mockMvc.perform(get(availableRoomsUrl(accommodationId))
				.header("Authorization", bearerToken())
				.param("checkInDate", checkInDate.toString())
				.param("checkOutDate", checkOutDate.toString())
				.param("guestCount", Integer.toString(guestCount))
				.param("page", Integer.toString(page))
				.param("size", Integer.toString(size)));
	}

	private Accommodation saveAccommodation(String name) {
		return accommodationRepository.saveAndFlush(accommodation(name));
	}

	private Room saveRoom(Accommodation accommodation, String name, int capacity) {
		return roomRepository.saveAndFlush(room(accommodation, name, capacity));
	}

	private void saveInventory(
			Room room,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			int totalQuantity,
			int reservedQuantity
	) {
		checkInDate.datesUntil(checkOutDate).forEach(date -> {
			RoomInventory inventory = RoomInventory.create(room, date, totalQuantity);
			if (reservedQuantity > 0) {
				inventory.reserve(reservedQuantity);
			}
			roomInventoryRepository.save(inventory);
		});
		roomInventoryRepository.flush();
	}

	@Test
	void excludesRoomWhenAnyStayDateInventoryIsMissingOrSoldOut() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		Room missingDate = saveRoom(accommodation, "Missing Date Room", 2);
		Room soldOutDate = saveRoom(accommodation, "Sold Out Date Room", 2);
		saveInventory(missingDate, CHECK_IN, CHECK_OUT.minusDays(1), 1, 0);
		saveInventory(soldOutDate, CHECK_IN, CHECK_OUT, 1, 0);
		RoomInventory soldOutInventory = roomInventoryRepository
				.findByRoomIdAndInventoryDate(soldOutDate.getId(), CHECK_IN.plusDays(2))
				.orElseThrow();
		soldOutInventory.reserve(1);

		performAvailable(accommodation.getId(), CHECK_IN, CHECK_OUT, 2, 0, 20)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0))
				.andExpect(jsonPath("$.totalElements").value(0));
	}

	private String availableRoomsUrl(Long accommodationId) {
		return "/api/v1/accommodations/" + accommodationId + "/rooms/available";
	}

	private String bearerToken() {
		return junsik.reservation.support.AuthenticationTestSupport.bearerToken(
				jwtTokenProvider,
				MemberRole.USER
		);
	}
}
