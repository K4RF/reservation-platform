package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.AuthenticationTestSupport.bearerToken;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.AccommodationBookingPolicy;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationBookingPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;
import junsik.reservation.service.ReservationDateProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class BookingPolicyReservationIntegrationTest {

	private static final LocalDate TODAY = LocalDate.of(2030, 1, 1);
	private static final LocalDate CHECK_IN = TODAY.plusDays(3);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private AccommodationBookingPolicyRepository bookingPolicyRepository;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private ReservationRepository reservationRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@MockitoBean
	private ReservationDateProvider dateProvider;

	@BeforeEach
	void setUpDate() {
		given(dateProvider.today()).willReturn(TODAY);
	}

	@Test
	void appliesSameMinimumStayRuleToAvailabilityAndReservationCreation() throws Exception {
		TestCatalog catalog = saveCatalogWithPolicy(2, 4, 3, 30);
		LocalDate oneNightCheckout = CHECK_IN.plusDays(1);

		performAvailable(catalog, CHECK_IN, oneNightCheckout)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_005"));

		performCreate(catalog, CHECK_IN, oneNightCheckout)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_005"));

		performAvailable(catalog, CHECK_IN, CHECK_IN.plusDays(2))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].roomId").value(catalog.room().getId()));

		performCreate(catalog, CHECK_IN, CHECK_IN.plusDays(2))
				.andExpect(status().isCreated());
	}

	@Test
	void appliesAdvanceWindowAndScheduleChangeRulesBeforeInventoryMutation() throws Exception {
		TestCatalog catalog = saveCatalogWithPolicy(1, 3, 3, 30);
		performAvailable(catalog, TODAY.plusDays(2), TODAY.plusDays(3))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_007"));
		performCreate(catalog, TODAY.plusDays(31), TODAY.plusDays(32))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_008"));

		performCreate(catalog, CHECK_IN, CHECK_IN.plusDays(2))
				.andExpect(status().isCreated());
		Reservation reservation = reservationRepository.findAll().getFirst();
		int reservedBefore = reservedQuantity(catalog.room(), CHECK_IN);

		mockMvc.perform(patch("/api/v1/reservations/{reservationId}", reservation.getId())
					.header("Authorization", bearerToken(jwtTokenProvider, catalog.member().getId(), MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content(scheduleRequest(CHECK_IN, CHECK_IN.plusDays(4))))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_006"));

		org.assertj.core.api.Assertions.assertThat(reservedQuantity(catalog.room(), CHECK_IN))
				.isEqualTo(reservedBefore);
		org.assertj.core.api.Assertions.assertThat(reservationRepository.findById(reservation.getId()).orElseThrow()
				.getCheckOutDate()).isEqualTo(CHECK_IN.plusDays(2));
	}

	private TestCatalog saveCatalogWithPolicy(int minStay, int maxStay, int minAdvance, int maxAdvance) {
		Member savedMember = memberRepository.saveAndFlush(member("booking-policy@example.com"));
		Accommodation savedAccommodation = accommodationRepository.saveAndFlush(accommodation());
		Room savedRoom = roomRepository.saveAndFlush(room(savedAccommodation));
		bookingPolicyRepository.saveAndFlush(AccommodationBookingPolicy.create(
				savedAccommodation,
				minStay,
				maxStay,
				minAdvance,
				maxAdvance
		));
		TODAY.datesUntil(TODAY.plusDays(40)).forEach(date ->
				roomInventoryRepository.save(RoomInventory.create(savedRoom, date, 10)));
		roomInventoryRepository.flush();
		return new TestCatalog(savedMember, savedAccommodation, savedRoom);
	}

	private org.springframework.test.web.servlet.ResultActions performAvailable(
			TestCatalog catalog,
			LocalDate checkIn,
			LocalDate checkOut
	) throws Exception {
		return mockMvc.perform(get(
				"/api/v1/accommodations/{accommodationId}/rooms/available",
				catalog.accommodation().getId()
		)
				.header("Authorization", bearerToken(jwtTokenProvider, catalog.member().getId(), MemberRole.USER))
				.param("checkInDate", checkIn.toString())
				.param("checkOutDate", checkOut.toString())
				.param("guestCount", "1"));
	}

	private org.springframework.test.web.servlet.ResultActions performCreate(
			TestCatalog catalog,
			LocalDate checkIn,
			LocalDate checkOut
	) throws Exception {
		return mockMvc.perform(post("/api/v1/reservations")
				.header("Authorization", bearerToken(jwtTokenProvider, catalog.member().getId(), MemberRole.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "roomId": %d,
						  "guestCount": 1,
						  "checkInDate": "%s",
						  "checkOutDate": "%s"
						}
						""".formatted(catalog.room().getId(), checkIn, checkOut)));
	}

	private String scheduleRequest(LocalDate checkIn, LocalDate checkOut) {
		return """
				{
				  "checkInDate": "%s",
				  "checkOutDate": "%s"
				}
				""".formatted(checkIn, checkOut);
	}

	private int reservedQuantity(Room room, LocalDate date) {
		return roomInventoryRepository.findByRoomIdAndInventoryDate(room.getId(), date)
				.orElseThrow()
				.getReservedQuantity();
	}

	private record TestCatalog(Member member, Accommodation accommodation, Room room) {
	}
}
