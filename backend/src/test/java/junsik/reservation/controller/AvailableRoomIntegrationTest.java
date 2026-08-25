package junsik.reservation.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
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
	private MemberRepository memberRepository;

	@Autowired
	private ReservationRepository reservationRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void returnsOnlyActiveAvailableRoomsForCapacityWithPagination() throws Exception {
		Accommodation accommodation = saveAccommodation("Ocean View Hotel");
		Accommodation otherAccommodation = saveAccommodation("Mountain Hotel");
		Member member = saveMember();

		Room firstAvailable = saveRoom(accommodation, "Available Twin", 2);
		Room secondAvailable = saveRoom(accommodation, "Cancelled Reservation Room", 4);
		saveRoom(accommodation, "Single Room", 1);
		Room reserved = saveRoom(accommodation, "Reserved Suite", 4);
		Room inactive = saveRoom(accommodation, "Inactive Room", 4);
		saveRoom(otherAccommodation, "Other Accommodation Room", 4);

		saveReservation(member, reserved, CHECK_IN.plusDays(1), CHECK_OUT.plusDays(1));
		Reservation cancelled = saveReservation(member, secondAvailable, CHECK_IN, CHECK_OUT);
		cancelled.cancel();
		reservationRepository.flush();
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
		saveReservation(saveMember(), room, CHECK_IN, CHECK_OUT);

		performAvailable(accommodation.getId(), CHECK_OUT, CHECK_OUT.plusDays(3), 2, 0, 20)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].roomId").value(room.getId()));
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
		return accommodationRepository.saveAndFlush(Accommodation.create(
				name,
				"Accommodation description",
				"Accommodation address"
		));
	}

	private Room saveRoom(Accommodation accommodation, String name, int capacity) {
		return roomRepository.saveAndFlush(Room.create(accommodation, name, capacity));
	}

	private Member saveMember() {
		return memberRepository.saveAndFlush(Member.createUser("available-room@example.com", "encoded-password"));
	}

	private Reservation saveReservation(
			Member member,
			Room room,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return reservationRepository.saveAndFlush(Reservation.create(member, room, checkInDate, checkOutDate));
	}

	private String availableRoomsUrl(Long accommodationId) {
		return "/api/v1/accommodations/" + accommodationId + "/rooms/available";
	}

	private String bearerToken() {
		return "Bearer " + jwtTokenProvider.createAccessToken(1L, MemberRole.USER);
	}
}
