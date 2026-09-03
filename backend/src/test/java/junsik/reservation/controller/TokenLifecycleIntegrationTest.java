package junsik.reservation.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static junsik.reservation.support.AuthenticationTestSupport.bearer;

import java.time.Instant;
import java.util.Optional;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.RefreshTokenStore;
import junsik.reservation.security.JwtProperties;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
class TokenLifecycleIntegrationTest {

	private static final Long MEMBER_ID = 15L;
	private static final String REISSUE_URL = "/api/v1/auth/reissue";
	private static final String LOGOUT_URL = "/api/v1/auth/logout";

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

	@MockitoBean
	private RefreshTokenStore refreshTokenStore;

	@Test
	void reissuesAccessTokenWithValidStoredRefreshToken() throws Exception {
		String refreshToken = jwtTokenProvider.createRefreshToken(MEMBER_ID, MemberRole.USER);
		when(refreshTokenStore.findByMemberId(MEMBER_ID)).thenReturn(Optional.of(refreshToken));

		MvcResult result = performReissue(refreshToken)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.tokenType").value("Bearer"))
				.andExpect(jsonPath("$.refreshToken").doesNotExist())
				.andReturn();

		String accessToken = JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
		Jwt jwt = jwtDecoder.decode(accessToken);
		org.assertj.core.api.Assertions.assertThat(jwt.getSubject()).isEqualTo(MEMBER_ID.toString());
		org.assertj.core.api.Assertions.assertThat(jwt.getClaimAsString("token_type")).isEqualTo("ACCESS");
	}

	@Test
	void rejectsAccessTokenAndExpiredRefreshTokenForReissue() throws Exception {
		performReissue(jwtTokenProvider.createAccessToken(MEMBER_ID, MemberRole.USER))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_005"));

		performReissue(createExpiredRefreshToken())
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_005"));
	}

	@Test
	void rejectsRefreshTokenAsApiAuthenticationCredential() throws Exception {
		String refreshToken = jwtTokenProvider.createRefreshToken(MEMBER_ID, MemberRole.USER);

		mockMvc.perform(get("/api/v1/accommodations")
					.header("Authorization", bearer(refreshToken)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_001"));
	}

	@Test
	void rejectsRefreshTokenThatDoesNotMatchRedisValue() throws Exception {
		String refreshToken = jwtTokenProvider.createRefreshToken(MEMBER_ID, MemberRole.USER);
		when(refreshTokenStore.findByMemberId(MEMBER_ID)).thenReturn(Optional.of("different-token"));

		performReissue(refreshToken)
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_006"));
	}

	@Test
	void rejectsBlankRefreshTokenRequest() throws Exception {
		mockMvc.perform(post(REISSUE_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"refreshToken\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void rejectsOversizedRefreshTokenRequest() throws Exception {
		mockMvc.perform(post(REISSUE_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"refreshToken\":\"%s\"}".formatted("x".repeat(4097))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[0].field").value("refreshToken"));
	}

	@Test
	void logoutDeletesRefreshTokenAndPreventsFurtherReissue() throws Exception {
		String accessToken = jwtTokenProvider.createAccessToken(MEMBER_ID, MemberRole.USER);
		String refreshToken = jwtTokenProvider.createRefreshToken(MEMBER_ID, MemberRole.USER);
		when(refreshTokenStore.findByMemberId(MEMBER_ID)).thenReturn(Optional.of(refreshToken));

		mockMvc.perform(post(LOGOUT_URL).header("Authorization", bearer(accessToken)))
				.andExpect(status().isNoContent());
		verify(refreshTokenStore).delete(MEMBER_ID);

		when(refreshTokenStore.findByMemberId(MEMBER_ID)).thenReturn(Optional.empty());
		performReissue(refreshToken)
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_006"));

		mockMvc.perform(get("/api/v1/accommodations")
					.header("Authorization", bearer(accessToken)))
				.andExpect(status().isOk());
	}

	@Test
	void rejectsLogoutWhenRefreshTokenDoesNotExist() throws Exception {
		String accessToken = jwtTokenProvider.createAccessToken(MEMBER_ID, MemberRole.USER);
		when(refreshTokenStore.findByMemberId(MEMBER_ID)).thenReturn(Optional.empty());

		mockMvc.perform(post(LOGOUT_URL).header("Authorization", bearer(accessToken)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_006"));
	}

	private org.springframework.test.web.servlet.ResultActions performReissue(String refreshToken) throws Exception {
		return mockMvc.perform(post(REISSUE_URL)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "refreshToken": "%s"
						}
						""".formatted(refreshToken)));
	}

	private String createExpiredRefreshToken() {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(jwtProperties.issuer())
				.issuedAt(now.minusSeconds(240))
				.expiresAt(now.minusSeconds(120))
				.subject(MEMBER_ID.toString())
				.claim("role", MemberRole.USER.name())
				.claim("token_type", "REFRESH")
				.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).type("JWT").build();
		return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}
}
