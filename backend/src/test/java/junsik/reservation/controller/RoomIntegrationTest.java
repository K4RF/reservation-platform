package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RoomIntegrationTest {

	private static final String ACCOMMODATIONS_URL = "/api/v1/accommodations";
	private static final String ROOMS_URL = "/api/v1/rooms";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void createsRoomForAccommodationWithAdminRole() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		String roomsUrl = roomsUrl(accommodation.getId());

		mockMvc.perform(post(roomsUrl)
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "  Deluxe Twin Room  ",
							  "capacity": 4,
							  "nightlyPrice": 150000.00
							}
							"""))
				.andExpect(status().isCreated())
				.andExpect(header().string(
						"Location",
						org.hamcrest.Matchers.matchesPattern("/api/v1/rooms/\\d+")
				))
				.andExpect(jsonPath("$.roomId").isNumber())
				.andExpect(jsonPath("$.accommodationId").value(accommodation.getId()))
				.andExpect(jsonPath("$.name").value("Deluxe Twin Room"))
				.andExpect(jsonPath("$.capacity").value(4))
				.andExpect(jsonPath("$.nightlyPrice").value(150000.00))
				.andExpect(jsonPath("$.status").value("ACTIVE"));

		Room savedRoom = roomRepository.findAll().getFirst();
		assertThat(savedRoom.getAccommodation().getId()).isEqualTo(accommodation.getId());
		assertThat(savedRoom.getName()).isEqualTo("Deluxe Twin Room");
		assertThat(savedRoom.getCapacity()).isEqualTo(4);
		assertThat(savedRoom.getNightlyPrice()).isEqualByComparingTo("150000.00");
		assertThat(savedRoom.getStatus()).isEqualTo(RoomStatus.ACTIVE);
	}

	@Test
	void updatesRoomInformationWithAdminRole() throws Exception {
		Room room = saveRoom(saveAccommodation("Ocean View Hotel"), 1);

		mockMvc.perform(put(ROOMS_URL + "/{roomId}", room.getId())
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "  Updated Suite  ",
							  "capacity": 6,
							  "nightlyPrice": 250000.00
							}
							"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Updated Suite"))
				.andExpect(jsonPath("$.capacity").value(6))
				.andExpect(jsonPath("$.nightlyPrice").value(250000.00))
				.andExpect(jsonPath("$.status").value("ACTIVE"));

		assertThat(room.getName()).isEqualTo("Updated Suite");
		assertThat(room.getNightlyPrice()).isEqualByComparingTo("250000.00");
	}

	@Test
	void changesRoomStatusWithAdminRole() throws Exception {
		Room room = saveRoom(saveAccommodation("Ocean View Hotel"), 1);

		mockMvc.perform(patch(ROOMS_URL + "/{roomId}/status", room.getId())
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"status\":\"INACTIVE\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("INACTIVE"));

		assertThat(room.getStatus()).isEqualTo(RoomStatus.INACTIVE);
	}

	@Test
	void rejectsRoomManagementFromUserRole() throws Exception {
		Room room = saveRoom(saveAccommodation("Ocean View Hotel"), 1);

		mockMvc.perform(put(ROOMS_URL + "/{roomId}", room.getId())
					.header("Authorization", bearerToken(MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content(validCreateRequest()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTH_002"));

		mockMvc.perform(patch(ROOMS_URL + "/{roomId}/status", room.getId())
					.header("Authorization", bearerToken(MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"status\":\"INACTIVE\"}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTH_002"));
	}

	@Test
	void rejectsInvalidAndUnknownRoomUpdate() throws Exception {
		Room room = saveRoom(saveAccommodation("Ocean View Hotel"), 1);

		mockMvc.perform(put(ROOMS_URL + "/{roomId}", room.getId())
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":\"\",\"capacity\":0,\"nightlyPrice\":0}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder(
						"name", "capacity", "nightlyPrice"
				)));

		mockMvc.perform(put(ROOMS_URL + "/999999")
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(validCreateRequest()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_001"));
	}

	@Test
	void rejectsInvalidRoomFields() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");

		mockMvc.perform(post(roomsUrl(accommodation.getId()))
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "",
							  "capacity": 0,
							  "nightlyPrice": 0
							}
							"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder(
						"name",
						"capacity",
						"nightlyPrice"
				)));

		assertThat(roomRepository.count()).isZero();
	}

	@Test
	void rejectsRoomCreationFromUserRole() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");

		mockMvc.perform(post(roomsUrl(accommodation.getId()))
					.header("Authorization", bearerToken(MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content(validCreateRequest()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.code").value("AUTH_002"))
				.andExpect(jsonPath("$.path").value(roomsUrl(accommodation.getId())));

		assertThat(roomRepository.count()).isZero();
	}

	@Test
	void rejectsRoomCreationForUnknownAccommodation() throws Exception {
		mockMvc.perform(post(roomsUrl(999999L))
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(validCreateRequest()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"))
				.andExpect(jsonPath("$.path").value(roomsUrl(999999L)));
	}

	@Test
	void getsRoomById() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		Room room = saveRoom(accommodation, 1);

		mockMvc.perform(get(ROOMS_URL + "/" + room.getId())
					.header("Authorization", bearerToken(MemberRole.USER)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.roomId").value(room.getId()))
				.andExpect(jsonPath("$.accommodationId").value(accommodation.getId()))
				.andExpect(jsonPath("$.name").value("Room 1"))
				.andExpect(jsonPath("$.capacity").value(2));
	}

	@Test
	void returnsNotFoundForUnknownRoom() throws Exception {
		mockMvc.perform(get(ROOMS_URL + "/999999")
					.header("Authorization", bearerToken(MemberRole.USER)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.code").value("ROOM_001"))
				.andExpect(jsonPath("$.message").value("존재하지 않는 객실입니다."))
				.andExpect(jsonPath("$.path").value(ROOMS_URL + "/999999"));
	}

	@Test
	void getsRoomPageForAccommodationOrderedById() throws Exception {
		Accommodation targetAccommodation = saveAccommodation("Ocean View Hotel");
		Accommodation otherAccommodation = saveAccommodation("Mountain Hotel");
		for (int index = 1; index <= 5; index++) {
			saveRoom(targetAccommodation, index);
		}
		saveRoom(otherAccommodation, 99);

		mockMvc.perform(get(roomsUrl(targetAccommodation.getId()))
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("page", "1")
					.param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].name").value("Room 3"))
				.andExpect(jsonPath("$.content[1].name").value("Room 4"))
				.andExpect(jsonPath("$.content[*].accommodationId").value(containsInAnyOrder(
						targetAccommodation.getId().intValue(),
						targetAccommodation.getId().intValue()
				)))
				.andExpect(jsonPath("$.page").value(1))
				.andExpect(jsonPath("$.size").value(2))
				.andExpect(jsonPath("$.totalElements").value(5))
				.andExpect(jsonPath("$.totalPages").value(3))
				.andExpect(jsonPath("$.first").value(false))
				.andExpect(jsonPath("$.last").value(false));
	}

	@Test
	void filtersRoomsByCapacityPriceAndStatusWithAllowedSort() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		Accommodation otherAccommodation = saveAccommodation("Mountain Hotel");
		Room standard = saveRoom(accommodation, "Standard", 4, "150000.00");
		Room suite = saveRoom(accommodation, "Suite", 3, "200000.00");
		saveRoom(accommodation, "Budget", 4, "90000.00");
		saveRoom(accommodation, "Small", 2, "180000.00");
		Room inactive = saveRoom(accommodation, "Inactive", 5, "180000.00");
		saveRoom(otherAccommodation, "Other", 5, "180000.00");
		jdbcTemplate.update("update rooms set status = 'INACTIVE' where id = ?", inactive.getId());

		mockMvc.perform(get(roomsUrl(accommodation.getId()))
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("minCapacity", "3")
					.param("minPrice", "100000.00")
					.param("maxPrice", "200000.00")
					.param("status", "ACTIVE")
					.param("sortBy", "NIGHTLY_PRICE")
					.param("direction", "DESC"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].roomId").value(suite.getId()))
				.andExpect(jsonPath("$.content[0].nightlyPrice").value(200000.00))
				.andExpect(jsonPath("$.content[1].roomId").value(standard.getId()))
				.andExpect(jsonPath("$.content[1].nightlyPrice").value(150000.00))
				.andExpect(jsonPath("$.totalElements").value(2));
	}

	@Test
	void rejectsInvalidRoomSearchFilters() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");

		mockMvc.perform(get(roomsUrl(accommodation.getId()))
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("minCapacity", "0")
					.param("minPrice", "-1"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));

		mockMvc.perform(get(roomsUrl(accommodation.getId()))
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("minPrice", "200000")
					.param("maxPrice", "100000"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("ROOM_003"));

		mockMvc.perform(get(roomsUrl(accommodation.getId()))
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("sortBy", "ACCOMMODATION"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void returnsNotFoundForRoomPageOfUnknownAccommodation() throws Exception {
		mockMvc.perform(get(roomsUrl(999999L))
					.header("Authorization", bearerToken(MemberRole.USER)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"))
				.andExpect(jsonPath("$.path").value(roomsUrl(999999L)));
	}

	private Accommodation saveAccommodation(String name) {
		return accommodationRepository.saveAndFlush(Accommodation.create(
				name,
				"Accommodation description",
				"Accommodation address"
		));
	}

	private Room saveRoom(Accommodation accommodation, int index) {
		return roomRepository.saveAndFlush(Room.create(accommodation, "Room " + index, index + 1));
	}

	private Room saveRoom(Accommodation accommodation, String name, int capacity, String nightlyPrice) {
		return roomRepository.saveAndFlush(Room.create(
				accommodation,
				name,
				capacity,
				new BigDecimal(nightlyPrice)
		));
	}

	private String roomsUrl(Long accommodationId) {
		return ACCOMMODATIONS_URL + "/" + accommodationId + "/rooms";
	}

	private String bearerToken(MemberRole role) {
		return "Bearer " + jwtTokenProvider.createAccessToken(1L, role);
	}

	private String validCreateRequest() {
		return """
				{
				  "name": "Deluxe Twin Room",
				  "capacity": 4,
				  "nightlyPrice": 150000.00
				}
				""";
	}
}
