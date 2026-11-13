package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.AuthenticationTestSupport.bearerToken;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccommodationBookingPolicyIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Autowired
	private EntityManager entityManager;

	@Test
	void readsStoredPolicyAfterAdminWritesForAnonymousUserAndAdmin() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		String url = policyUrl(accommodation.getId());

		String created = mockMvc.perform(post(url)
					.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(2, 14, 1, 365)))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", url))
				.andExpect(jsonPath("$.bookingPolicyId").isNumber())
				.andExpect(jsonPath("$.accommodationId").value(accommodation.getId()))
				.andExpect(jsonPath("$.minStayNights").value(2))
				.andExpect(jsonPath("$.maxAdvanceBookingDays").value(365))
				.andReturn().getResponse().getContentAsString();
		flushAndClear();
		mockMvc.perform(get(url))
				.andExpect(status().isOk())
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(content().json(created));

		String updated = mockMvc.perform(put(url)
					.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(1, 30, 0, 180)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.minStayNights").value(1))
				.andExpect(jsonPath("$.maxStayNights").value(30))
				.andExpect(jsonPath("$.minAdvanceBookingDays").value(0))
				.andExpect(jsonPath("$.maxAdvanceBookingDays").value(180))
				.andReturn().getResponse().getContentAsString();
		flushAndClear();
		for (MemberRole role : MemberRole.values()) {
			mockMvc.perform(get(url).header("Authorization", bearerToken(jwtTokenProvider, role)))
					.andExpect(status().isOk())
					.andExpect(content().json(updated));
		}
	}

	@Test
	void distinguishesUnconfiguredPolicyFromMissingAccommodation() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		mockMvc.perform(get(policyUrl(accommodation.getId())))
				.andExpect(status().isNoContent())
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(content().string(""));
		mockMvc.perform(get(policyUrl(Long.MAX_VALUE)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"));
	}

	@ParameterizedTest
	@ValueSource(longs = {0L, -1L})
	void rejectsNonPositiveAccommodationId(long id) throws Exception {
		mockMvc.perform(get(policyUrl(id)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void rejectsNonNumericAccommodationId() throws Exception {
		mockMvc.perform(get("/api/v1/accommodations/not-an-id/booking-policy"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_002"));
	}

	@Test
	void rejectsDuplicateAndInvalidPolicyRanges() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		String url = policyUrl(accommodation.getId());
		String adminToken = bearerToken(jwtTokenProvider, MemberRole.ADMIN);

		mockMvc.perform(post(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(1, 10, 0, 100)))
				.andExpect(status().isCreated());

		mockMvc.perform(post(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(1, 10, 0, 100)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_002"));

		mockMvc.perform(put(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(5, 4, 0, 100)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_003"));
	}

	@Test
	void requiresAdminRoleAndExistingResources() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		String url = policyUrl(accommodation.getId());

		for (MockHttpServletRequestBuilder write : new MockHttpServletRequestBuilder[] {post(url), put(url)}) {
			write.contentType(MediaType.APPLICATION_JSON).content(policyRequest(1, 10, 0, 100));
			mockMvc.perform(write)
					.andExpect(status().isUnauthorized())
					.andExpect(jsonPath("$.code").value("AUTH_001"));
			mockMvc.perform(write.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.USER)))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("AUTH_002"));
		}
		mockMvc.perform(delete(url)).andExpect(status().isUnauthorized());
		mockMvc.perform(get(url.replace("booking-policy", "cancellation-policy")))
				.andExpect(status().isUnauthorized());

		mockMvc.perform(post(policyUrl(999999L))
					.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(1, 10, 0, 100)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"));

		mockMvc.perform(put(policyUrl(accommodation.getId()))
					.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(1, 10, 0, 100)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("BOOKING_POLICY_001"));
	}

	private void flushAndClear() {
		entityManager.flush();
		entityManager.clear();
	}

	private String policyUrl(Long accommodationId) {
		return "/api/v1/accommodations/" + accommodationId + "/booking-policy";
	}

	private String policyRequest(int minStay, int maxStay, int minAdvance, int maxAdvance) {
		return """
				{
				  "minStayNights": %d,
				  "maxStayNights": %d,
				  "minAdvanceBookingDays": %d,
				  "maxAdvanceBookingDays": %d
				}
				""".formatted(minStay, maxStay, minAdvance, maxAdvance);
	}
}
