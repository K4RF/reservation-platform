package junsik.reservation;

import static junsik.reservation.support.AuthenticationTestSupport.bearer;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Clock;
import java.time.ZoneOffset;
import java.time.ZoneId;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import junsik.reservation.support.MvpTestFixture;
import junsik.reservation.support.MySqlIntegrationTestSupport;

@AutoConfigureMockMvc
@Transactional
class BookingPolicyCatalogBaselineIntegrationTest extends MySqlIntegrationTestSupport {

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
	private static final LocalDate CLOSED_INVENTORY_DATE = LocalDate.of(2035, 6, 16);
	private static final Instant CANCELLATION_INSTANT = Instant.parse("2035-06-08T03:00:00Z");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private ReservationRepository reservationRepository;

	@Autowired
	private jakarta.persistence.EntityManager entityManager;

	@MockitoBean
	private RefreshTokenStore refreshTokenStore;

	@MockitoBean
	private Clock clock;

	private String timeZone;

	private MvpTestFixture fixture;

	@BeforeEach
	void setUp() {
		fixture = new MvpTestFixture(jdbcTemplate, passwordEncoder);
		when(clock.instant()).thenReturn(CANCELLATION_INSTANT);
		when(clock.getZone()).thenReturn(ZoneOffset.UTC);
	}

	@ParameterizedTest
	@ValueSource(strings = {"Asia/Tokyo", "America/New_York"})
	void completesBookingPolicyAndCatalogBaselineOnMySql(String timeZone) throws Exception {
		this.timeZone = timeZone;
		UserSession userSession = signUpAndLoginUser();
		Long userId = userSession.userId();
		String userToken = userSession.accessToken();
		fixture.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
		String adminToken = login(ADMIN_EMAIL, ADMIN_PASSWORD);

		Long accommodationId = createAccommodation(adminToken);
		Long roomId = createRoom(adminToken, accommodationId);
		createBookingPolicy(adminToken, accommodationId);
		createCancellationPolicy(adminToken, accommodationId, 30, 50);
		fixture.createRoomInventory(
				roomId,
				ORIGINAL_CHECK_IN,
				CHANGED_CHECK_OUT,
				1
		);
		createDailyPrice(adminToken, roomId, ORIGINAL_CHECK_IN, "120000.00");
		createDailyPrice(adminToken, roomId, CHANGED_CHECK_IN, "140000.00");

		assertAccommodationCatalog(userToken, accommodationId);
		assertClosedInventoryCannotBeReserved(adminToken, userToken, roomId);
		assertSearchAndEffectivePrices(userToken, accommodationId, roomId);

		Long reservationId = createReservation(userToken, userId, roomId);
		updateCancellationPolicy(adminToken, accommodationId, 80, 90);
		assertReservedDates(roomId, ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT);
		assertUnavailableAfterReservation(userToken, accommodationId, roomId);
		assertReservationQuery(userToken, reservationId, ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT);

		changeSchedule(userToken, reservationId);
		assertScheduleInventoryChanged(roomId);
		assertReservationQuery(userToken, reservationId, CHANGED_CHECK_IN, CHANGED_CHECK_OUT);

		cancelReservation(userToken, reservationId);
		var cancelledReservation = reservationRepository.findById(reservationId).orElseThrow();
		assertThat(cancelledReservation.getStatus()).isEqualTo(ReservationStatus.CANCELLED);
		assertThat(cancelledReservation.getCancelledAt()).isEqualTo(CANCELLATION_INSTANT);
		assertThat(cancelledReservation.getCancellationFeeAmount()).isEqualByComparingTo("132000.00");
		assertThat(cancelledReservation.getRefundAmount()).isEqualByComparingTo("308000.00");
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
							  "name": "Baseline Tokyo Hotel",
							  "description": "Booking policy and catalog completion baseline",
							  "country": "일본",
							  "city": "도쿄도",
							  "region": "신주쿠구",
							  "address": "니시신주쿠 1-1",
							  "amenities": ["PARKING", "POOL"],
							  "checkInTime": "15:00:00",
							  "checkOutTime": "11:00:00",
							  "timeZone": "%s"
							}
							""".formatted(timeZone)))
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
							  "nightlyPrice": 100000.00,
							  "amenities": ["WIFI", "AIR_CONDITIONER"]
							}
							"""))
				.andExpect(status().isCreated())
				.andReturn();
		return readLong(result, "$.roomId");
	}

	private void createBookingPolicy(String adminToken, Long accommodationId) throws Exception {
		mockMvc.perform(post(ACCOMMODATIONS_URL + "/{accommodationId}/booking-policy", accommodationId)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "minStayNights": 2,
							  "maxStayNights": 5,
							  "minAdvanceBookingDays": 1,
							  "maxAdvanceBookingDays": 365
							}
							"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.accommodationId").value(accommodationId))
				.andExpect(jsonPath("$.minStayNights").value(2))
				.andExpect(jsonPath("$.maxStayNights").value(5));
	}

	private void createCancellationPolicy(
			String adminToken,
			Long accommodationId,
			int earlyFeeRate,
			int lateFeeRate
	) throws Exception {
		mockMvc.perform(post(ACCOMMODATIONS_URL + "/{accommodationId}/cancellation-policy", accommodationId)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content(cancellationPolicyRequest(earlyFeeRate, lateFeeRate)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.accommodationId").value(accommodationId))
				.andExpect(jsonPath("$.feeRules[0].feeRatePercent").value(earlyFeeRate));
	}

	private void updateCancellationPolicy(
			String adminToken,
			Long accommodationId,
			int earlyFeeRate,
			int lateFeeRate
	) throws Exception {
		mockMvc.perform(put(ACCOMMODATIONS_URL + "/{accommodationId}/cancellation-policy", accommodationId)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content(cancellationPolicyRequest(earlyFeeRate, lateFeeRate)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.feeRules[0].feeRatePercent").value(earlyFeeRate));
	}

	private String cancellationPolicyRequest(int earlyFeeRate, int lateFeeRate) {
		return """
				{
				  "freeCancellationDaysBeforeCheckIn": 7,
				  "cancellationDeadlineDaysBeforeCheckIn": 1,
				  "feeRules": [
				    {"minDaysBeforeCheckIn": 3, "feeRatePercent": %d},
				    {"minDaysBeforeCheckIn": 1, "feeRatePercent": %d}
				  ]
				}
				""".formatted(earlyFeeRate, lateFeeRate);
	}

	private void assertAccommodationCatalog(String userToken, Long accommodationId) throws Exception {
		mockMvc.perform(get(ACCOMMODATIONS_URL + "/{accommodationId}", accommodationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.country").value("일본"))
				.andExpect(jsonPath("$.city").value("도쿄도"))
				.andExpect(jsonPath("$.region").value("신주쿠구"))
				.andExpect(jsonPath("$.amenities.length()").value(2))
				.andExpect(jsonPath("$.checkInTime").value("15:00:00"))
				.andExpect(jsonPath("$.checkOutTime").value("11:00:00"))
				.andExpect(jsonPath("$.timeZone").value(timeZone));
	}

	private void assertClosedInventoryCannotBeReserved(
			String adminToken,
			String userToken,
			Long roomId
	) throws Exception {
		mockMvc.perform(post("/api/v1/rooms/{roomId}/inventories", roomId)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "inventoryDate": "%s",
							  "totalQuantity": 1
							}
							""".formatted(CLOSED_INVENTORY_DATE)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.saleStatus").value("OPEN"));
		mockMvc.perform(post("/api/v1/rooms/{roomId}/inventories", roomId)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "inventoryDate": "%s",
							  "totalQuantity": 1
							}
							""".formatted(CLOSED_INVENTORY_DATE.plusDays(1))))
				.andExpect(status().isCreated());

		mockMvc.perform(put("/api/v1/rooms/{roomId}/inventories/{inventoryDate}", roomId, CLOSED_INVENTORY_DATE)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "totalQuantity": 1,
							  "saleStatus": "CLOSED"
							}
							"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.availableQuantity").value(1))
				.andExpect(jsonPath("$.saleStatus").value("CLOSED"));

		mockMvc.perform(get("/api/v1/rooms/{roomId}/inventories", roomId)
					.header("Authorization", bearer(adminToken))
					.param("startDate", ORIGINAL_CHECK_IN.toString())
					.param("endDate", CLOSED_INVENTORY_DATE.plusDays(1).toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.inventories.length()").value(7))
				.andExpect(jsonPath("$.inventories[5].inventoryDate").value(CLOSED_INVENTORY_DATE.toString()))
				.andExpect(jsonPath("$.inventories[5].saleStatus").value("CLOSED"))
				.andExpect(jsonPath("$.inventories[6].saleStatus").value("OPEN"));

		mockMvc.perform(post(RESERVATIONS_URL)
					.header("Authorization", bearer(userToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "roomId": %d,
							  "guestCount": 1,
							  "checkInDate": "%s",
							  "checkOutDate": "%s",
							  "representativeGuest": {
							    "name": "Closed Inventory Guest",
							    "email": "closed@example.com",
							    "phone": "010-0000-0000"
							  }
							}
							""".formatted(roomId, CLOSED_INVENTORY_DATE, CLOSED_INVENTORY_DATE.plusDays(2))))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("INVENTORY_009"));
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
					.param("name", "tokyo")
					.param("city", "도쿄도")
					.param("region", "신주쿠구")
					.param("accommodationAmenities", "PARKING", "POOL")
					.param("roomAmenities", "WIFI", "AIR_CONDITIONER")
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
							  "checkOutDate": "%s",
							  "representativeGuest": {
							    "name": "Baseline Guest",
							    "email": "guest@example.com",
							    "phone": "010-1234-5678"
							  }
							}
							""".formatted(roomId, ORIGINAL_CHECK_IN, ORIGINAL_CHECK_OUT)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.reservationNumber").value(
						org.hamcrest.Matchers.matchesPattern("RSV-" + localToday().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE) + "-[A-F0-9]{16}")
				))
				.andExpect(jsonPath("$.memberId").value(userId))
				.andExpect(jsonPath("$.guestCount").value(4))
				.andExpect(jsonPath("$.representativeGuest.name").value("Baseline Guest"))
				.andExpect(jsonPath("$.representativeGuest.email").value("guest@example.com"))
				.andExpect(jsonPath("$.representativeGuest.phone").value("010-1234-5678"))
				.andExpect(jsonPath("$.nightlyPriceSnapshot").value(120000.00))
				.andExpect(jsonPath("$.stayNights").value(3))
				.andExpect(jsonPath("$.totalAmount").value(360000.00))
				.andExpect(jsonPath("$.nights.length()").value(3))
				.andExpect(jsonPath("$.nights[0].stayDate").value(ORIGINAL_CHECK_IN.toString()))
				.andExpect(jsonPath("$.nights[0].priceSnapshot").value(120000.00))
				.andExpect(jsonPath("$.nights[1].priceSnapshot").value(140000.00))
				.andExpect(jsonPath("$.nights[2].priceSnapshot").value(100000.00))
				.andExpect(jsonPath("$.cancellationPolicySnapshot.freeCancellationDaysBeforeCheckIn").value(7))
				.andExpect(jsonPath("$.cancellationPolicySnapshot.feeRules[0].feeRatePercent").value(30))
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
				.andExpect(jsonPath("$.totalAmount").value(440000.00))
				.andExpect(jsonPath("$.nights.length()").value(4))
				.andExpect(jsonPath("$.nights[0].stayDate").value(CHANGED_CHECK_IN.toString()))
				.andExpect(jsonPath("$.nights[0].priceSnapshot").value(140000.00))
				.andExpect(jsonPath("$.nights[3].stayDate").value(CHANGED_CHECK_OUT.minusDays(1).toString()))
				.andExpect(jsonPath("$.nights[3].priceSnapshot").value(100000.00))
				.andExpect(jsonPath("$.cancellationPolicySnapshot.feeRules[0].feeRatePercent").value(30));
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
		entityManager.flush();
		entityManager.clear();
		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", reservationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reservationNumber").isNotEmpty())
				.andExpect(jsonPath("$.representativeGuest.name").value("Baseline Guest"))
				.andExpect(jsonPath("$.checkInDate").value(checkInDate.toString()))
				.andExpect(jsonPath("$.checkOutDate").value(checkOutDate.toString()))
				.andExpect(jsonPath("$.cancellationPolicySnapshot.feeRules[0].feeRatePercent").value(30));

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
				.andExpect(jsonPath("$.cancelledAt").value(CANCELLATION_INSTANT.toString()))
				.andExpect(jsonPath("$.cancellationDate").value(localToday().toString()))
				.andExpect(jsonPath("$.daysBeforeCheckIn").value((int) java.time.temporal.ChronoUnit.DAYS.between(localToday(), CHANGED_CHECK_IN)))
				.andExpect(jsonPath("$.totalAmount").value(440000.00))
				.andExpect(jsonPath("$.cancellationFeeRate").value(30))
				.andExpect(jsonPath("$.cancellationFeeAmount").value(132000.00))
				.andExpect(jsonPath("$.estimatedRefundAmount").value(308000.00));

		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", reservationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"))
				.andExpect(jsonPath("$.cancelledAt").value(CANCELLATION_INSTANT.toString()))
				.andExpect(jsonPath("$.cancellationFeeAmount").value(132000.00))
				.andExpect(jsonPath("$.refundAmount").value(308000.00))
				.andExpect(jsonPath("$.cancellationPolicySnapshot.feeRules[0].feeRatePercent").value(30));
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

	private LocalDate localToday() {
		return LocalDate.ofInstant(CANCELLATION_INSTANT, ZoneId.of(timeZone));
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
