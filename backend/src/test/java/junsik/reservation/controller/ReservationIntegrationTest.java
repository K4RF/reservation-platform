package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ReservationIntegrationTest {

	private static final String RESERVATIONS_URL = "/api/v1/reservations";
	private static final LocalDate CHECK_IN = LocalDate.of(2030, 1, 10);
	private static final LocalDate CHECK_OUT = LocalDate.of(2030, 1, 15);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private ReservationRepository reservationRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void createsConfirmedReservationForAuthenticatedMember() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();

		mockMvc.perform(post(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest(room.getId(), CHECK_IN, CHECK_OUT)))
				.andExpect(status().isCreated())
				.andExpect(header().string(
						"Location",
						org.hamcrest.Matchers.matchesPattern("/api/v1/reservations/\\d+")
				))
				.andExpect(jsonPath("$.reservationId").isNumber())
				.andExpect(jsonPath("$.memberId").value(member.getId()))
				.andExpect(jsonPath("$.roomId").value(room.getId()))
				.andExpect(jsonPath("$.checkInDate").value("2030-01-10"))
				.andExpect(jsonPath("$.checkOutDate").value("2030-01-15"))
				.andExpect(jsonPath("$.status").value("CONFIRMED"));

		Reservation reservation = reservationRepository.findAll().getFirst();
		assertThat(reservation.getMember().getId()).isEqualTo(member.getId());
		assertThat(reservation.getRoom().getId()).isEqualTo(room.getId());
		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
	}

	@Test
	void rejectsReservationCreationWithoutAuthentication() throws Exception {
		Room room = saveRoom();

		mockMvc.perform(post(RESERVATIONS_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content(createRequest(room.getId(), CHECK_IN, CHECK_OUT)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_001"));

		assertThat(reservationRepository.count()).isZero();
	}

	@Test
	void rejectsMissingReservationFields() throws Exception {
		Member member = saveMember("member@example.com");

		mockMvc.perform(post(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "roomId": null,
							  "checkInDate": null,
							  "checkOutDate": null
							}
							"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder(
						"roomId",
						"checkInDate",
						"checkOutDate"
				)));

		assertThat(reservationRepository.count()).isZero();
	}

	@Test
	void rejectsSameOrReversedReservationPeriod() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();

		performCreate(member.getId(), room.getId(), CHECK_IN, CHECK_IN)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("RESERVATION_001"));

		performCreate(member.getId(), room.getId(), CHECK_OUT, CHECK_IN)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("RESERVATION_001"));

		assertThat(reservationRepository.count()).isZero();
	}

	@Test
	void rejectsReservationForUnknownRoom() throws Exception {
		Member member = saveMember("member@example.com");

		performCreate(member.getId(), 999999L, CHECK_IN, CHECK_OUT)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ROOM_001"))
				.andExpect(jsonPath("$.path").value(RESERVATIONS_URL));
	}

	@Test
	void rejectsReservationForUnknownAuthenticatedMember() throws Exception {
		Room room = saveRoom();

		performCreate(999999L, room.getId(), CHECK_IN, CHECK_OUT)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("MEMBER_002"))
				.andExpect(jsonPath("$.path").value(RESERVATIONS_URL));
	}

	@Test
	void rejectsReservationThatOverlapsConfirmedReservation() throws Exception {
		Member firstMember = saveMember("first@example.com");
		Member secondMember = saveMember("second@example.com");
		Room room = saveRoom();
		reservationRepository.saveAndFlush(Reservation.create(firstMember, room, CHECK_IN, CHECK_OUT));

		performCreate(secondMember.getId(), room.getId(), CHECK_IN.plusDays(2), CHECK_OUT.plusDays(2))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.code").value("RESERVATION_002"))
				.andExpect(jsonPath("$.message").value("해당 기간에 이미 예약된 객실입니다."));

		assertThat(reservationRepository.count()).isOne();
	}

	@Test
	void allowsReservationStartingOnExistingCheckoutDate() throws Exception {
		Member firstMember = saveMember("first@example.com");
		Member secondMember = saveMember("second@example.com");
		Room room = saveRoom();
		reservationRepository.saveAndFlush(Reservation.create(firstMember, room, CHECK_IN, CHECK_OUT));

		performCreate(secondMember.getId(), room.getId(), CHECK_OUT, CHECK_OUT.plusDays(3))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.checkInDate").value("2030-01-15"))
				.andExpect(jsonPath("$.checkOutDate").value("2030-01-18"));

		assertThat(reservationRepository.count()).isEqualTo(2);
	}

	private org.springframework.test.web.servlet.ResultActions performCreate(
			Long memberId,
			Long roomId,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) throws Exception {
		return mockMvc.perform(post(RESERVATIONS_URL)
				.header("Authorization", bearerToken(memberId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(createRequest(roomId, checkInDate, checkOutDate)));
	}

	private Member saveMember(String email) {
		return memberRepository.saveAndFlush(Member.createUser(email, "encoded-password"));
	}

	private Room saveRoom() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(Accommodation.create(
				"Ocean View Hotel",
				"Accommodation description",
				"Accommodation address"
		));
		return roomRepository.saveAndFlush(Room.create(accommodation, "Deluxe Room", 4));
	}

	private String bearerToken(Long memberId) {
		return "Bearer " + jwtTokenProvider.createAccessToken(memberId, MemberRole.USER);
	}

	private String createRequest(Long roomId, LocalDate checkInDate, LocalDate checkOutDate) {
		return """
				{
				  "roomId": %d,
				  "checkInDate": "%s",
				  "checkOutDate": "%s"
				}
				""".formatted(roomId, checkInDate, checkOutDate);
	}
}
