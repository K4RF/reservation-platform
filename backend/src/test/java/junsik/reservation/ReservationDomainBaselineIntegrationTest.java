package junsik.reservation;

import static junsik.reservation.support.AuthenticationTestSupport.bearer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.repository.RefreshTokenStore;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.service.ReservationDateProvider;
import junsik.reservation.support.MvpTestFixture;
import junsik.reservation.support.MySqlIntegrationTestSupport;

@AutoConfigureMockMvc
@Transactional
class ReservationDomainBaselineIntegrationTest extends MySqlIntegrationTestSupport {

	private static final String MEMBERS_URL = "/api/v1/members";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String ACCOMMODATIONS_URL = "/api/v1/accommodations";
	private static final String RESERVATIONS_URL = "/api/v1/reservations";
	private static final String USER_EMAIL = "baseline-user@example.com";
	private static final String USER_PASSWORD = "UserPassword123!";
	private static final String ADMIN_EMAIL = "baseline-admin@example.com";
	private static final String ADMIN_PASSWORD = "AdminPassword123!";
	private static final LocalDate ORIGINAL_CHECK_IN = LocalDate.of(2035, 6, 10);
	private static final LocalDate ORIGINAL_CHECK_OUT = LocalDate.of(2035, 6, 13);
	private static final LocalDate CHANGED_CHECK_IN = LocalDate.of(2035, 6, 11);
	private static final LocalDate CHANGED_CHECK_OUT = LocalDate.of(2035, 6, 15);
	private static final LocalDate CANCELLATION_DATE = LocalDate.of(2035, 6, 8);
	private static final Instant CANCELLATION_INSTANT = Instant.parse("2035-06-08T03:00:00Z");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private ReservationRepository reservationRepository;

	@MockitoBean
	private RefreshTokenStore refreshTokenStore;

	@MockitoBean
	private ReservationDateProvider reservationDateProvider;

	private MvpTestFixture fixture;

	@BeforeEach
	void setUp() {
		fixture = new MvpTestFixture(jdbcTemplate, passwordEncoder);
		when(reservationDateProvider.today()).thenReturn(CANCELLATION_DATE);
		when(reservationDateProvider.now()).thenReturn(CANCELLATION_INSTANT);
	}

	@Test
	void completesReservationDomainBaselineOnMySql() throws Exception {
		UserSession userSession = signUpAndLoginUser();
		Long userId = userSession.userId();
		String userToken = userSession.accessToken();
		fixture.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
		String adminToken = login(ADMIN_EMAIL, ADMIN_PASSWORD);

		Long accommodationId = createAccommodation(adminToken);
		Long roomId = createRoom(adminToken, accommodationId);
		fixture.createRoomInventory(
				roomId,
				ORIGINAL_CHECK_IN,
				CHANGED_CHECK_OUT,
				1
		);
		createDailyPrice(adminToken, roomId, ORIGINAL_CHECK_IN, "120000.00");
		createDailyPrice(adminToken, roomId, CHANGED_CHECK_IN, "140000.00");

		assertSearchAndEffectivePrices(userToken, accommodationId, roomId);

		Long reservationId = createReservation(userToken, userId, roomId);
		assertReservedDates(roomId, ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT);
		assertUnavailableAfterReservation(userToken, accommodationId, roomId);
		assertReservationQuery(userToken, reservationId, ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT);

		changeSchedule(userToken, reservationId);
		assertScheduleInventoryChanged(roomId);
		assertReservationQuery(userToken, reservationId, CHANGED_CHECK_IN, CHANGED_CHECK_OUT);

		cancelReservation(userToken, reservationId);
		assertThat(reservationRepository.findById(reservationId).orElseThrow().getStatus())
				.isEqualTo(ReservationStatus.CANCELLED);
		assertInventoryRange(roomId, ORIGINAL_CHECK_IN, CHANGED_CHECK_OUT, 0);
	}

	private UserSession signUpAndLoginUser() throws Exception {
		MvcResult signUp = mockMvc.perform(post(MEMBERS_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content(credentials(USER_EMAIL, USER_PASSWORD)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.email").value(USER_EMAIL))
				.andReturn();
		return new UserSession(readLong(signUp, "$.memberId"), login(USER_EMAIL, USER_PASSWORD));
	}

	private Long createAccommodation(String adminToken) throws Exception {
		MvcResult result = mockMvc.perform(post(ACCOMMODATIONS_URL)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "Baseline Seoul Hotel",
							  "description": "Reservation domain completion baseline",
							  "country": "대한민국",
							  "city": "서울특별시",
							  "region": "강남구",
							  "address": "서울 강남구 테헤란로"
							}
							"""))
				.andExpect(status().isCreated())
				.andReturn();
		return readLong(result, "$.accommodationId");
	}

	private Long createRoom(String adminToken, Long accommodationId) throws Exception {
		MvcResult result = mockMvc.perform(post(ACCOMMODATIONS_URL + "/{accommodationId}/rooms", accommodationId)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "Baseline Family Room",
							  "capacity": 4,
							  "nightlyPrice": 100000.00
							}
							"""))
				.andExpect(status().isCreated())
				.andReturn();
		return readLong(result, "$.roomId");
	}

	private void createDailyPrice(
			String adminToken,
			Long roomId,
			LocalDate stayDate,
			String nightlyPrice
	) throws Exception {
		mockMvc.perform(post("/api/v1/rooms/{roomId}/prices", roomId)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "stayDate": "%s",
							  "nightlyPrice": %s
							}
							""".formatted(stayDate, nightlyPrice)))
				.andExpect(status().isCreated());
	}

	private void assertSearchAndEffectivePrices(
			String userToken,
			Long accommodationId,
			Long roomId
	) throws Exception {
		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearer(userToken))
					.param("name", "seoul")
					.param("region", "강남구")
					.param("checkInDate", ORIGINAL_CHECK_IN.toString())
					.param("checkOutDate", ORIGINAL_CHECK_OUT.toString())
					.param("guestCount", "4")
					.param("minPrice", "90000")
					.param("maxPrice", "110000")
					.param("status", "ACTIVE")
					.param("available", "true"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].accommodationId").value(accommodationId));

		mockMvc.perform(get(ACCOMMODATIONS_URL + "/{accommodationId}/rooms/available", accommodationId)
					.header("Authorization", bearer(userToken))
					.param("checkInDate", ORIGINAL_CHECK_IN.toString())
					.param("checkOutDate", ORIGINAL_CHECK_OUT.toString())
					.param("guestCount", "4"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].roomId").value(roomId));

		mockMvc.perform(get("/api/v1/rooms/{roomId}/prices/{stayDate}", roomId, ORIGINAL_CHECK_IN)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nightlyPrice").value(120000.00))
				.andExpect(jsonPath("$.source").value("DAILY"));

		mockMvc.perform(get("/api/v1/rooms/{roomId}/prices/{stayDate}", roomId, ORIGINAL_CHECK_IN.plusDays(2))
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nightlyPrice").value(100000.00))
				.andExpect(jsonPath("$.source").value("DEFAULT"));
	}

	private Long createReservation(String userToken, Long userId, Long roomId) throws Exception {
		MvcResult result = mockMvc.perform(post(RESERVATIONS_URL)
					.header("Authorization", bearer(userToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "roomId": %d,
							  "guestCount": 4,
							  "checkInDate": "%s",
							  "checkOutDate": "%s"
							}
							""".formatted(roomId, ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.memberId").value(userId))
				.andExpect(jsonPath("$.guestCount").value(4))
				.andExpect(jsonPath("$.nightlyPriceSnapshot").value(120000.00))
				.andExpect(jsonPath("$.stayNights").value(3))
				.andExpect(jsonPath("$.totalAmount").value(360000.00))
				.andExpect(jsonPath("$.status").value("CONFIRMED"))
				.andReturn();
		return readLong(result, "$.reservationId");
	}

	private void assertUnavailableAfterReservation(
			String userToken,
			Long accommodationId,
			Long roomId
	) throws Exception {
		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearer(userToken))
					.param("checkInDate", ORIGINAL_CHECK_IN.toString())
					.param("checkOutDate", ORIGINAL_CHECK_OUT.toString())
					.param("guestCount", "4")
					.param("available", "false"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].accommodationId").value(accommodationId));

		mockMvc.perform(get(ACCOMMODATIONS_URL + "/{accommodationId}/rooms/available", accommodationId)
					.header("Authorization", bearer(userToken))
					.param("checkInDate", ORIGINAL_CHECK_IN.toString())
					.param("checkOutDate", ORIGINAL_CHECK_OUT.toString())
					.param("guestCount", "4"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0));
		assertInventoryRange(roomId, ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT, 1);
	}

	private void changeSchedule(String userToken, Long reservationId) throws Exception {
		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}", reservationId)
					.header("Authorization", bearer(userToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "checkInDate": "%s",
							  "checkOutDate": "%s"
							}
							""".formatted(CHANGED_CHECK_IN, CHANGED_CHECK_OUT)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.guestCount").value(4))
				.andExpect(jsonPath("$.nightlyPriceSnapshot").value(140000.00))
				.andExpect(jsonPath("$.stayNights").value(4))
				.andExpect(jsonPath("$.totalAmount").value(440000.00));
	}

	private void assertScheduleInventoryChanged(Long roomId) {
		assertInventory(roomId, ORIGINAL_CHECK_IN, 0);
		assertInventoryRange(roomId, CHANGED_CHECK_IN, CHANGED_CHECK_OUT, 1);
	}

	private void assertReservationQuery(
			String userToken,
			Long reservationId,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) throws Exception {
		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", reservationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.checkInDate").value(checkInDate.toString()))
				.andExpect(jsonPath("$.checkOutDate").value(checkOutDate.toString()));

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearer(userToken))
					.param("status", "CONFIRMED")
					.param("checkInFrom", checkInDate.toString())
					.param("checkInTo", checkInDate.toString())
					.param("sortBy", "CHECK_IN_DATE")
					.param("direction", "ASC"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].reservationId").value(reservationId));
	}

	private void cancelReservation(String userToken, Long reservationId) throws Exception {
		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}/cancel", reservationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"))
				.andExpect(jsonPath("$.cancellationDate").value(CANCELLATION_DATE.toString()))
				.andExpect(jsonPath("$.daysBeforeCheckIn").value(3))
				.andExpect(jsonPath("$.totalAmount").value(440000.00))
				.andExpect(jsonPath("$.cancellationFeeRate").value(30))
				.andExpect(jsonPath("$.cancellationFeeAmount").value(132000.00))
				.andExpect(jsonPath("$.estimatedRefundAmount").value(308000.00));
	}

	private String login(String email, String password) throws Exception {
		MvcResult result = mockMvc.perform(post(LOGIN_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content(credentials(email, password)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andReturn();
		return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
	}

	private void assertReservedDates(Long roomId, LocalDate startDate, LocalDate endDate) {
		assertInventoryRange(roomId, startDate, endDate, 1);
		assertInventory(roomId, endDate, 0);
	}

	private void assertInventoryRange(Long roomId, LocalDate startDate, LocalDate endDate, int expected) {
		startDate.datesUntil(endDate).forEach(date -> assertInventory(roomId, date, expected));
	}

	private void assertInventory(Long roomId, LocalDate inventoryDate, int expected) {
		reservationRepository.flush();
		Integer reservedQuantity = jdbcTemplate.queryForObject(
				"select reserved_quantity from room_inventories where room_id = ? and inventory_date = ?",
				Integer.class,
				roomId,
				inventoryDate
		);
		assertThat(reservedQuantity).isEqualTo(expected);
	}

	private Long readLong(MvcResult result, String path) throws Exception {
		Number value = JsonPath.read(result.getResponse().getContentAsString(), path);
		return value.longValue();
	}

	private String credentials(String email, String password) {
		return """
				{
				  "email": "%s",
				  "password": "%s"
				}
				""".formatted(email, password);
	}

	private record UserSession(Long userId, String accessToken) {
	}
}
