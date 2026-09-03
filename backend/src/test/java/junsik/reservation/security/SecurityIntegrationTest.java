package junsik.reservation.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import junsik.reservation.enums.MemberRole;

@SpringBootTest
@AutoConfigureMockMvc
@Import(SecurityIntegrationTest.TestController.class)
class SecurityIntegrationTest {

	private static final String PROTECTED_URL = "/api/v1/test/protected";
	private static final String ADMIN_URL = "/api/v1/admin/test";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Autowired
	private JwtEncoder jwtEncoder;

	@Autowired
	private JwtDecoder jwtDecoder;

	@Autowired
	private JwtProperties jwtProperties;

	@Test
	void allowsPublicMemberSignUpEndpointWithoutAuthentication() throws Exception {
		mockMvc.perform(post("/api/v1/members")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"email\":\"invalid-email\",\"password\":\"short\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void rejectsUnauthenticatedRequestWithUnauthorizedResponse() throws Exception {
		mockMvc.perform(get(PROTECTED_URL))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.code").value("AUTH_001"))
				.andExpect(jsonPath("$.message").value("인증이 필요합니다."))
				.andExpect(jsonPath("$.path").value(PROTECTED_URL))
				.andExpect(jsonPath("$.errors").isEmpty());
	}

	@Test
	void authenticatesRequestWithValidJwt() throws Exception {
		String token = jwtTokenProvider.createAccessToken(15L, MemberRole.USER);

		mockMvc.perform(get(PROTECTED_URL).header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.memberId").value(15))
				.andExpect(jsonPath("$.role").value("USER"));

		Jwt decoded = jwtDecoder.decode(token);
		assertThat(decoded.getSubject()).isEqualTo("15");
		assertThat(decoded.getClaimAsString("role")).isEqualTo("USER");
		assertThat(decoded.getClaimAsString("iss")).isEqualTo(jwtProperties.issuer());
		assertThat(decoded.getExpiresAt()).isAfter(decoded.getIssuedAt());
	}

	@Test
	void rejectsExpiredJwt() throws Exception {
		String token = createExpiredToken(15L, MemberRole.USER);

		mockMvc.perform(get(PROTECTED_URL).header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_001"));
	}

	@Test
	void rejectsTamperedJwt() throws Exception {
		String validToken = jwtTokenProvider.createAccessToken(15L, MemberRole.USER);
		String tamperedToken = tamperSignature(validToken);

		mockMvc.perform(get(PROTECTED_URL).header("Authorization", "Bearer " + tamperedToken))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_001"));
	}

	@Test
	void rejectsRequestWhenMemberDoesNotHaveRequiredRole() throws Exception {
		String token = jwtTokenProvider.createAccessToken(15L, MemberRole.USER);

		mockMvc.perform(get(ADMIN_URL).header("Authorization", "Bearer " + token))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.code").value("AUTH_002"))
				.andExpect(jsonPath("$.message").value("접근 권한이 없습니다."))
				.andExpect(jsonPath("$.path").value(ADMIN_URL))
				.andExpect(jsonPath("$.errors").isEmpty());
	}

	private String createExpiredToken(Long memberId, MemberRole role) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(jwtProperties.issuer())
				.issuedAt(now.minusSeconds(240))
				.expiresAt(now.minusSeconds(120))
				.subject(memberId.toString())
				.claim("role", role.name())
				.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
		return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}

	private String tamperSignature(String token) {
		int signatureStart = token.lastIndexOf('.') + 1;
		char replacement = token.charAt(signatureStart) == 'a' ? 'b' : 'a';
		return token.substring(0, signatureStart)
				+ replacement
				+ token.substring(signatureStart + 1);
	}

	@RestController
	static class TestController {

		@GetMapping(PROTECTED_URL)
		Map<String, Object> protectedEndpoint(@AuthenticationPrincipal MemberPrincipal principal) {
			return Map.of("memberId", principal.memberId(), "role", principal.role());
		}

		@GetMapping(ADMIN_URL)
		void adminEndpoint() {
		}
	}
}
