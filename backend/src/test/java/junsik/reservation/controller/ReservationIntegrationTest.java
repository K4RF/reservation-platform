package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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

	@Test
	void getsOwnReservationById() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();
		Reservation reservation = saveReservation(member, room, CHECK_IN, CHECK_OUT);

		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", reservation.getId())
					.header("Authorization", bearerToken(member.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reservationId").value(reservation.getId()))
				.andExpect(jsonPath("$.memberId").value(member.getId()))
				.andExpect(jsonPath("$.roomId").value(room.getId()))
				.andExpect(jsonPath("$.checkInDate").value("2030-01-10"))
				.andExpect(jsonPath("$.checkOutDate").value("2030-01-15"))
				.andExpect(jsonPath("$.status").value("CONFIRMED"));
	}

	@Test
	void getsOnlyOwnReservationsWithPagination() throws Exception {
		Member member = saveMember("member@example.com");
		Member otherMember = saveMember("other@example.com");
		Room room = saveRoom();
		Reservation first = saveReservation(member, room, CHECK_IN, CHECK_OUT);
		Reservation second = saveReservation(member, room, CHECK_OUT, CHECK_OUT.plusDays(2));
		Reservation third = saveReservation(member, room, CHECK_OUT.plusDays(2), CHECK_OUT.plusDays(4));
		saveReservation(otherMember, room, CHECK_OUT.plusDays(4), CHECK_OUT.plusDays(6));

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("page", "0")
					.param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].reservationId").value(first.getId()))
				.andExpect(jsonPath("$.content[1].reservationId").value(second.getId()))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(2))
				.andExpect(jsonPath("$.totalElements").value(3))
				.andExpect(jsonPath("$.totalPages").value(2))
				.andExpect(jsonPath("$.first").value(true))
				.andExpect(jsonPath("$.last").value(false));

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("page", "1")
					.param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].reservationId").value(third.getId()))
				.andExpect(jsonPath("$.last").value(true));
	}

	@Test
	void cancelsOwnConfirmedReservation() throws Exception {
		Member member = saveMember("member@example.com");
		Reservation reservation = saveReservation(member, saveRoom(), CHECK_IN, CHECK_OUT);

		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}/cancel", reservation.getId())
					.header("Authorization", bearerToken(member.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reservationId").value(reservation.getId()))
				.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertThat(reservationRepository.findById(reservation.getId()).orElseThrow().getStatus())
				.isEqualTo(ReservationStatus.CANCELLED);
	}

	@Test
	void rejectsOtherMembersReservationQueryAndCancellation() throws Exception {
		Member owner = saveMember("owner@example.com");
		Member otherMember = saveMember("other@example.com");
		Reservation reservation = saveReservation(owner, saveRoom(), CHECK_IN, CHECK_OUT);

		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", reservation.getId())
					.header("Authorization", bearerToken(otherMember.getId())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RESERVATION_004"));

		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}/cancel", reservation.getId())
					.header("Authorization", bearerToken(otherMember.getId())))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RESERVATION_004"));

		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
	}

	@Test
	void rejectsUnknownReservationQueryAndCancellation() throws Exception {
		Member member = saveMember("member@example.com");

		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", 999999L)
					.header("Authorization", bearerToken(member.getId())))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESERVATION_003"));

		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}/cancel", 999999L)
					.header("Authorization", bearerToken(member.getId())))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESERVATION_003"));
	}

	@Test
	void rejectsCancellingAlreadyCancelledReservation() throws Exception {
		Member member = saveMember("member@example.com");
		Reservation reservation = saveReservation(member, saveRoom(), CHECK_IN, CHECK_OUT);

		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}/cancel", reservation.getId())
					.header("Authorization", bearerToken(member.getId())))
				.andExpect(status().isOk());

		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}/cancel", reservation.getId())
					.header("Authorization", bearerToken(member.getId())))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("RESERVATION_005"))
				.andExpect(jsonPath("$.message").value("이미 취소된 예약입니다."));
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

	private Reservation saveReservation(
			Member member,
			Room room,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return reservationRepository.saveAndFlush(
				Reservation.create(member, room, checkInDate, checkOutDate)
		);
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
