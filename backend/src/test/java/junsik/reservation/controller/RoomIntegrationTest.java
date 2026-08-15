package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.MemberRole;
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
							  "capacity": 4
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
				.andExpect(jsonPath("$.capacity").value(4));

		Room savedRoom = roomRepository.findAll().getFirst();
		assertThat(savedRoom.getAccommodation().getId()).isEqualTo(accommodation.getId());
		assertThat(savedRoom.getName()).isEqualTo("Deluxe Twin Room");
		assertThat(savedRoom.getCapacity()).isEqualTo(4);
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
							  "capacity": 0
							}
							"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "capacity")));

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
				  "capacity": 4
				}
				""";
	}
}
