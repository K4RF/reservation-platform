package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.AuthenticationTestSupport.bearerToken;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccommodationCancellationPolicyIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void adminCreatesAndUpdatesCancellationPolicyWithOrderedFeeRules() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		String url = policyUrl(accommodation.getId());
		String adminToken = bearerToken(jwtTokenProvider, MemberRole.ADMIN);

		mockMvc.perform(post(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(7, 1, 30, 50)))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", url))
				.andExpect(jsonPath("$.cancellationPolicyId").isNumber())
				.andExpect(jsonPath("$.accommodationId").value(accommodation.getId()))
				.andExpect(jsonPath("$.feeRules[0].minDaysBeforeCheckIn").value(3))
				.andExpect(jsonPath("$.feeRules[0].feeRatePercent").value(30))
				.andExpect(jsonPath("$.feeRules[1].minDaysBeforeCheckIn").value(1));

		mockMvc.perform(put(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(10, 1, 60, 80)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.freeCancellationDaysBeforeCheckIn").value(10))
				.andExpect(jsonPath("$.feeRules[0].feeRatePercent").value(60))
				.andExpect(jsonPath("$.feeRules[1].feeRatePercent").value(80));
	}

	@Test
	void rejectsDuplicateAndInvalidPolicyDefinitions() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());
		String url = policyUrl(accommodation.getId());
		String adminToken = bearerToken(jwtTokenProvider, MemberRole.ADMIN);

		mockMvc.perform(post(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(7, 1, 30, 50)))
				.andExpect(status().isCreated());
		mockMvc.perform(post(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(7, 1, 30, 50)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("CANCELLATION_POLICY_002"));

		mockMvc.perform(put(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(1, 1, 30, 50)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CANCELLATION_POLICY_003"));

		mockMvc.perform(put(url)
					.header("Authorization", adminToken)
					.contentType(MediaType.APPLICATION_JSON)
					.content(invalidCoverageRequest()))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("CANCELLATION_POLICY_004"));
	}

	@Test
	void requiresAdminAndExistingResources() throws Exception {
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation());

		mockMvc.perform(post(policyUrl(accommodation.getId()))
					.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(7, 1, 30, 50)))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTH_002"));

		mockMvc.perform(post(policyUrl(999999L))
					.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(7, 1, 30, 50)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"));

		mockMvc.perform(put(policyUrl(accommodation.getId()))
					.header("Authorization", bearerToken(jwtTokenProvider, MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(policyRequest(7, 1, 30, 50)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("CANCELLATION_POLICY_001"));
	}

	private String policyUrl(Long accommodationId) {
		return "/api/v1/accommodations/" + accommodationId + "/cancellation-policy";
	}

	private String policyRequest(int freeDays, int deadlineDays, int earlyRate, int lateRate) {
		return """
				{
				  "freeCancellationDaysBeforeCheckIn": %d,
				  "cancellationDeadlineDaysBeforeCheckIn": %d,
				  "feeRules": [
				    {"minDaysBeforeCheckIn": 1, "feeRatePercent": %d},
				    {"minDaysBeforeCheckIn": 3, "feeRatePercent": %d}
				  ]
				}
				""".formatted(freeDays, deadlineDays, lateRate, earlyRate);
	}

	private String invalidCoverageRequest() {
		return """
				{
				  "freeCancellationDaysBeforeCheckIn": 7,
				  "cancellationDeadlineDaysBeforeCheckIn": 1,
				  "feeRules": [{"minDaysBeforeCheckIn": 2, "feeRatePercent": 30}]
				}
				""";
	}
}
