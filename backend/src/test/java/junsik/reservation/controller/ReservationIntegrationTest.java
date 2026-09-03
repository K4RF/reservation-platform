package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.ReservationFixture.reservation;
import static junsik.reservation.support.RoomFixture.room;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.enums.RoomStatus;
import junsik.reservation.enums.AccommodationStatus;
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
	private static final BigDecimal NIGHTLY_PRICE = new BigDecimal("125000.00");

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
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private EntityManager entityManager;

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
				.andExpect(jsonPath("$.nightlyPriceSnapshot").value(125000.00))
				.andExpect(jsonPath("$.stayNights").value(5))
				.andExpect(jsonPath("$.totalAmount").value(625000.00))
				.andExpect(jsonPath("$.status").value("CONFIRMED"));

		Reservation reservation = reservationRepository.findAll().getFirst();
		assertThat(reservation.getMember().getId()).isEqualTo(member.getId());
		assertThat(reservation.getRoom().getId()).isEqualTo(room.getId());
		assertThat(reservation.getNightlyPriceSnapshot()).isEqualByComparingTo("125000.00");
		assertThat(reservation.getStayNights()).isEqualTo(5);
		assertThat(reservation.getTotalAmount()).isEqualByComparingTo("625000.00");
		assertThat(reservation.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
	}

	@Test
	void calculatesOneNightReservationAmount() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();

		performCreate(member.getId(), room.getId(), CHECK_IN, CHECK_IN.plusDays(1))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.nightlyPriceSnapshot").value(125000.00))
				.andExpect(jsonPath("$.stayNights").value(1))
				.andExpect(jsonPath("$.totalAmount").value(125000.00));
	}

	@Test
	void keepsReservationPriceSnapshotWhenRoomPriceChanges() {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();
		Reservation reservation = saveReservation(member, room, CHECK_IN, CHECK_OUT);

		jdbcTemplate.update(
				"update rooms set nightly_price = ? where id = ?",
				new BigDecimal("200000.00"),
				room.getId()
		);
		entityManager.clear();

		Reservation reloaded = reservationRepository.findById(reservation.getId()).orElseThrow();
		assertThat(reloaded.getRoom().getNightlyPrice()).isEqualByComparingTo("200000.00");
		assertThat(reloaded.getNightlyPriceSnapshot()).isEqualByComparingTo("125000.00");
		assertThat(reloaded.getStayNights()).isEqualTo(5);
		assertThat(reloaded.getTotalAmount()).isEqualByComparingTo("625000.00");
	}

	@Test
	void updatesOwnConfirmedReservationScheduleAndRecalculatesAmountFromSnapshot() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();
		Reservation reservation = saveReservation(member, room, CHECK_IN, CHECK_OUT);
		jdbcTemplate.update(
				"update rooms set nightly_price = ? where id = ?",
				new BigDecimal("200000.00"),
				room.getId()
		);
		entityManager.clear();

		performUpdate(
				member.getId(),
				reservation.getId(),
				LocalDate.of(2030, 2, 10),
				LocalDate.of(2030, 2, 13)
		)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reservationId").value(reservation.getId()))
				.andExpect(jsonPath("$.checkInDate").value("2030-02-10"))
				.andExpect(jsonPath("$.checkOutDate").value("2030-02-13"))
				.andExpect(jsonPath("$.nightlyPriceSnapshot").value(125000.00))
				.andExpect(jsonPath("$.stayNights").value(3))
				.andExpect(jsonPath("$.totalAmount").value(375000.00))
				.andExpect(jsonPath("$.status").value("CONFIRMED"));

		reservationRepository.flush();
		entityManager.clear();
		Reservation reloaded = reservationRepository.findById(reservation.getId()).orElseThrow();
		assertThat(reloaded.getCheckInDate()).isEqualTo(LocalDate.of(2030, 2, 10));
		assertThat(reloaded.getCheckOutDate()).isEqualTo(LocalDate.of(2030, 2, 13));
		assertThat(reloaded.getNightlyPriceSnapshot()).isEqualByComparingTo("125000.00");
		assertThat(reloaded.getTotalAmount()).isEqualByComparingTo("375000.00");
	}

	@Test
	void excludesCurrentReservationFromScheduleOverlapCheck() throws Exception {
		Member member = saveMember("member@example.com");
		Reservation reservation = saveReservation(member, saveRoom(), CHECK_IN, CHECK_OUT);

		performUpdate(member.getId(), reservation.getId(), CHECK_IN, CHECK_OUT)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.checkInDate").value("2030-01-10"))
				.andExpect(jsonPath("$.checkOutDate").value("2030-01-15"));
	}

	@Test
	void rejectsScheduleUpdateOverlappingAnotherConfirmedReservation() throws Exception {
		Member member = saveMember("member@example.com");
		Member otherMember = saveMember("other@example.com");
		Room room = saveRoom();
		Reservation reservation = saveReservation(member, room, CHECK_IN, CHECK_OUT);
		saveReservation(
				otherMember,
				room,
				LocalDate.of(2030, 2, 10),
				LocalDate.of(2030, 2, 15)
		);

		performUpdate(
				member.getId(),
				reservation.getId(),
				LocalDate.of(2030, 2, 12),
				LocalDate.of(2030, 2, 17)
		)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("RESERVATION_002"));

		assertThat(reservation.getCheckInDate()).isEqualTo(CHECK_IN);
		assertThat(reservation.getCheckOutDate()).isEqualTo(CHECK_OUT);
	}

	@Test
	void rejectsOtherMembersReservationScheduleUpdate() throws Exception {
		Member owner = saveMember("owner@example.com");
		Member otherMember = saveMember("other@example.com");
		Reservation reservation = saveReservation(owner, saveRoom(), CHECK_IN, CHECK_OUT);

		performUpdate(otherMember.getId(), reservation.getId(), CHECK_IN.plusDays(1), CHECK_OUT.plusDays(1))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RESERVATION_004"));
	}

	@Test
	void rejectsCancelledReservationScheduleUpdate() throws Exception {
		Member member = saveMember("member@example.com");
		Reservation reservation = saveReservation(member, saveRoom(), CHECK_IN, CHECK_OUT);
		reservation.cancel();
		reservationRepository.flush();

		performUpdate(member.getId(), reservation.getId(), CHECK_IN.plusDays(1), CHECK_OUT.plusDays(1))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("RESERVATION_006"))
				.andExpect(jsonPath("$.message").value("취소된 예약은 일정을 변경할 수 없습니다."));
	}

	@Test
	void rejectsInvalidReservationScheduleUpdatePeriod() throws Exception {
		Member member = saveMember("member@example.com");
		Reservation reservation = saveReservation(member, saveRoom(), CHECK_IN, CHECK_OUT);

		performUpdate(member.getId(), reservation.getId(), CHECK_IN, CHECK_IN)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("RESERVATION_001"));

		performUpdate(member.getId(), reservation.getId(), CHECK_OUT, CHECK_IN)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("RESERVATION_001"));
	}

	@Test
	void rejectsMissingReservationScheduleUpdateFields() throws Exception {
		Member member = saveMember("member@example.com");
		Reservation reservation = saveReservation(member, saveRoom(), CHECK_IN, CHECK_OUT);

		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}", reservation.getId())
					.header("Authorization", bearerToken(member.getId()))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "checkInDate": null,
							  "checkOutDate": null
							}
							"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder(
						"checkInDate",
						"checkOutDate"
				)));
	}

	@Test
	void rejectsUnknownReservationScheduleUpdate() throws Exception {
		Member member = saveMember("member@example.com");

		performUpdate(member.getId(), 999999L, CHECK_IN, CHECK_OUT)
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("RESERVATION_003"));
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
	void rejectsReservationCreationForInactiveRoom() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();
		room.changeStatus(RoomStatus.INACTIVE);
		roomRepository.flush();

		performCreate(member.getId(), room.getId(), CHECK_IN, CHECK_OUT)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ROOM_004"));

		assertThat(reservationRepository.count()).isZero();
	}

	@Test
	void rejectsReservationCreationForInactiveAccommodation() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();
		room.getAccommodation().changeStatus(AccommodationStatus.INACTIVE);
		accommodationRepository.flush();

		performCreate(member.getId(), room.getId(), CHECK_IN, CHECK_OUT)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_002"));

		assertThat(reservationRepository.count()).isZero();
	}

	@Test
	void keepsExistingReservationAfterRoomAndAccommodationDeactivation() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();
		Reservation reservation = saveReservation(member, room, CHECK_IN, CHECK_OUT);

		room.changeStatus(RoomStatus.INACTIVE);
		room.getAccommodation().changeStatus(AccommodationStatus.INACTIVE);
		roomRepository.flush();
		accommodationRepository.flush();

		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", reservation.getId())
					.header("Authorization", bearerToken(member.getId())))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reservationId").value(reservation.getId()))
				.andExpect(jsonPath("$.status").value("CONFIRMED"));

		assertThat(reservationRepository.count()).isOne();
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
		reservationRepository.saveAndFlush(reservation(firstMember, room, CHECK_IN, CHECK_OUT));

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
		reservationRepository.saveAndFlush(reservation(firstMember, room, CHECK_IN, CHECK_OUT));

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
	void filtersOwnReservationsByStatus() throws Exception {
		Member member = saveMember("member@example.com");
		Member otherMember = saveMember("other@example.com");
		Room room = saveRoom();
		Reservation confirmed = saveReservation(member, room, CHECK_IN, CHECK_OUT);
		Reservation cancelled = saveReservation(member, room, CHECK_OUT, CHECK_OUT.plusDays(2));
		cancelled.cancel();
		Reservation otherCancelled = saveReservation(
				otherMember,
				room,
				CHECK_OUT.plusDays(2),
				CHECK_OUT.plusDays(4)
		);
		otherCancelled.cancel();
		reservationRepository.flush();

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("status", "CANCELLED"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].reservationId").value(cancelled.getId()))
				.andExpect(jsonPath("$.content[0].memberId").value(member.getId()))
				.andExpect(jsonPath("$.content[0].status").value("CANCELLED"))
				.andExpect(jsonPath("$.totalElements").value(1));

		assertThat(confirmed.getStatus()).isEqualTo(ReservationStatus.CONFIRMED);
	}

	@Test
	void filtersReservationDatesWithInclusiveBoundaries() throws Exception {
		Member member = saveMember("member@example.com");
		Member otherMember = saveMember("other@example.com");
		Room room = saveRoom();
		saveReservation(member, room, LocalDate.of(2030, 1, 1), LocalDate.of(2030, 1, 3));
		Reservation firstMatch = saveReservation(
				member,
				room,
				LocalDate.of(2030, 1, 5),
				LocalDate.of(2030, 1, 10)
		);
		Reservation secondMatch = saveReservation(
				member,
				room,
				LocalDate.of(2030, 1, 10),
				LocalDate.of(2030, 1, 20)
		);
		saveReservation(otherMember, room, LocalDate.of(2030, 1, 7), LocalDate.of(2030, 1, 12));

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("checkInFrom", "2030-01-05")
					.param("checkInTo", "2030-01-10")
					.param("checkOutFrom", "2030-01-10")
					.param("checkOutTo", "2030-01-20"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].reservationId").value(firstMatch.getId()))
				.andExpect(jsonPath("$.content[1].reservationId").value(secondMatch.getId()))
				.andExpect(jsonPath("$.totalElements").value(2));
	}

	@Test
	void combinesReservationFiltersSortingAndPagination() throws Exception {
		Member member = saveMember("member@example.com");
		Room room = saveRoom();
		Reservation shortest = saveReservation(
				member,
				room,
				LocalDate.of(2030, 2, 1),
				LocalDate.of(2030, 2, 3)
		);
		Reservation middle = saveReservation(
				member,
				room,
				LocalDate.of(2030, 2, 4),
				LocalDate.of(2030, 2, 7)
		);
		Reservation longest = saveReservation(
				member,
				room,
				LocalDate.of(2030, 2, 8),
				LocalDate.of(2030, 2, 12)
		);
		shortest.cancel();
		middle.cancel();
		longest.cancel();
		reservationRepository.flush();

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("status", "CANCELLED")
					.param("checkInFrom", "2030-02-01")
					.param("checkInTo", "2030-02-10")
					.param("page", "1")
					.param("size", "1")
					.param("sortBy", "TOTAL_AMOUNT")
					.param("direction", "DESC"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].reservationId").value(middle.getId()))
				.andExpect(jsonPath("$.content[0].totalAmount").value(375000.00))
				.andExpect(jsonPath("$.page").value(1))
				.andExpect(jsonPath("$.size").value(1))
				.andExpect(jsonPath("$.totalElements").value(3))
				.andExpect(jsonPath("$.totalPages").value(3));
	}

	@Test
	void rejectsInvalidReservationSearchConditions() throws Exception {
		Member member = saveMember("member@example.com");

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("checkInFrom", "2030-01-11")
					.param("checkInTo", "2030-01-10"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("RESERVATION_007"));

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("checkOutFrom", "2030-01-11")
					.param("checkOutTo", "2030-01-10"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("RESERVATION_007"));

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearerToken(member.getId()))
					.param("sortBy", "MEMBER_ID"))
				.andExpect(status().isBadRequest());
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

	private org.springframework.test.web.servlet.ResultActions performUpdate(
			Long memberId,
			Long reservationId,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) throws Exception {
		return mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}", reservationId)
				.header("Authorization", bearerToken(memberId))
				.contentType(MediaType.APPLICATION_JSON)
				.content(updateRequest(checkInDate, checkOutDate)));
	}

	private Member saveMember(String email) {
		return memberRepository.saveAndFlush(member(email));
	}

	private Room saveRoom() {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		return roomRepository.saveAndFlush(room(accommodation, "Deluxe Room", 4, NIGHTLY_PRICE));
	}

	private Reservation saveReservation(
			Member member,
			Room room,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return reservationRepository.saveAndFlush(reservation(member, room, checkInDate, checkOutDate));
	}

	private String bearerToken(Long memberId) {
		return junsik.reservation.support.AuthenticationTestSupport.bearerToken(
				jwtTokenProvider,
				memberId,
				MemberRole.USER
		);
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

	private String updateRequest(LocalDate checkInDate, LocalDate checkOutDate) {
		return """
				{
				  "checkInDate": "%s",
				  "checkOutDate": "%s"
				}
				""".formatted(checkInDate, checkOutDate);
	}
}
