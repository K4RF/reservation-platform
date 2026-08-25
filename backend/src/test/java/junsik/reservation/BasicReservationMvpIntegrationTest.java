package junsik.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.repository.RefreshTokenStore;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.support.MvpTestFixture;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class BasicReservationMvpIntegrationTest {

	private static final String MEMBERS_URL = "/api/v1/members";
	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String ACCOMMODATIONS_URL = "/api/v1/accommodations";
	private static final String RESERVATIONS_URL = "/api/v1/reservations";
	private static final String USER_EMAIL = "mvp-user@example.com";
	private static final String USER_PASSWORD = "UserPassword123!";
	private static final String ADMIN_EMAIL = "mvp-admin@example.com";
	private static final String ADMIN_PASSWORD = "AdminPassword123!";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private ReservationRepository reservationRepository;

	@Autowired
	private JwtDecoder jwtDecoder;

	@MockitoBean
	private RefreshTokenStore refreshTokenStore;

	private MvpTestFixture fixture;

	@BeforeEach
	void setUp() {
		fixture = new MvpTestFixture(jdbcTemplate, passwordEncoder);
	}

	@Test
	void completesBasicReservationMvpFlow() throws Exception {
		MvcResult signUpResult = mockMvc.perform(post(MEMBERS_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content(credentials(USER_EMAIL, USER_PASSWORD)))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", org.hamcrest.Matchers.matchesPattern("/api/v1/members/\\d+")))
				.andExpect(jsonPath("$.email").value(USER_EMAIL))
				.andExpect(jsonPath("$.role").value("USER"))
				.andReturn();
		Long userId = readLong(signUpResult, "$.memberId");

		String userToken = login(USER_EMAIL, USER_PASSWORD, "USER");
		fixture.createAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
		String adminToken = login(ADMIN_EMAIL, ADMIN_PASSWORD, "ADMIN");

		MvcResult accommodationResult = mockMvc.perform(post(ACCOMMODATIONS_URL)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "MVP Ocean Hotel",
							  "description": "End-to-end test accommodation",
							  "address": "100 Test Beach Road"
							}
							"""))
				.andExpect(status().isCreated())
				.andReturn();
		Long accommodationId = readLong(accommodationResult, "$.accommodationId");

		mockMvc.perform(get(ACCOMMODATIONS_URL + "/{accommodationId}", accommodationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("MVP Ocean Hotel"));

		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].accommodationId").value(accommodationId));

		String accommodationRoomsUrl = ACCOMMODATIONS_URL + "/" + accommodationId + "/rooms";
		MvcResult roomResult = mockMvc.perform(post(accommodationRoomsUrl)
					.header("Authorization", bearer(adminToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "MVP Deluxe Room",
							  "capacity": 2,
							  "nightlyPrice": 120000.00
							}
							"""))
				.andExpect(status().isCreated())
				.andReturn();
		Long roomId = readLong(roomResult, "$.roomId");

		mockMvc.perform(get("/api/v1/rooms/{roomId}", roomId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.roomId").value(roomId))
				.andExpect(jsonPath("$.accommodationId").value(accommodationId));

		mockMvc.perform(get(accommodationRoomsUrl)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].roomId").value(roomId));

		MvcResult reservationResult = mockMvc.perform(post(RESERVATIONS_URL)
					.header("Authorization", bearer(userToken))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "roomId": %d,
							  "checkInDate": "2035-06-10",
							  "checkOutDate": "2035-06-13"
							}
							""".formatted(roomId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.memberId").value(userId))
				.andExpect(jsonPath("$.nightlyPriceSnapshot").value(120000.00))
				.andExpect(jsonPath("$.stayNights").value(3))
				.andExpect(jsonPath("$.totalAmount").value(360000.00))
				.andExpect(jsonPath("$.status").value("CONFIRMED"))
				.andReturn();
		Long reservationId = readLong(reservationResult, "$.reservationId");

		mockMvc.perform(get(RESERVATIONS_URL + "/{reservationId}", reservationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.reservationId").value(reservationId));

		mockMvc.perform(get(RESERVATIONS_URL)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].reservationId").value(reservationId));

		mockMvc.perform(patch(RESERVATIONS_URL + "/{reservationId}/cancel", reservationId)
					.header("Authorization", bearer(userToken)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("CANCELLED"));

		assertThat(reservationRepository.findById(reservationId).orElseThrow().getStatus())
				.isEqualTo(ReservationStatus.CANCELLED);
	}

	private String login(String email, String password, String expectedRole) throws Exception {
		MvcResult result = mockMvc.perform(post(LOGIN_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content(credentials(email, password)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andReturn();
		String token = JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
		Jwt jwt = jwtDecoder.decode(token);
		assertThat(jwt.getClaimAsString("role")).isEqualTo(expectedRole);
		return token;
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

	private String bearer(String token) {
		return "Bearer " + token;
	}
}
