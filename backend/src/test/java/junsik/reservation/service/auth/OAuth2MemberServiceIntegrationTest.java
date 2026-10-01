package junsik.reservation.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static junsik.reservation.support.MemberFixture.member;

import java.util.Map;
import java.util.Optional;

import com.jayway.jsonpath.JsonPath;
import org.redisson.api.RedissonClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.member.Member;
import junsik.reservation.entity.member.SocialAccount;
import junsik.reservation.enums.OAuthProvider;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.RefreshTokenStore;
import junsik.reservation.repository.OAuth2LoginCodeStore;
import junsik.reservation.repository.OAuth2LoginCodeStore.Identity;
import junsik.reservation.repository.SocialAccountRepository;
import junsik.reservation.security.OAuth2AuthenticationFailureHandler;
import junsik.reservation.security.OAuth2AuthenticationSuccessHandler;
import junsik.reservation.security.OAuth2MemberPrincipal;
import junsik.reservation.security.OAuth2FrontendFlow;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OAuth2MemberServiceIntegrationTest {

	private static final String PROVIDER_USER_ID = "google-user-123";
	private static final String EMAIL = "social@example.com";
	private static final String FRONTEND_STATE = "frontend-state-0123456789-abcdefgh";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private OAuth2MemberService oauth2MemberService;

	@Autowired
	private OAuth2AuthenticationSuccessHandler successHandler;

	@Autowired
	private OAuth2AuthenticationFailureHandler failureHandler;

	@Autowired
	private OAuth2FrontendFlow frontendFlow;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private SocialAccountRepository socialAccountRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtDecoder jwtDecoder;

	@MockitoBean
	private RefreshTokenStore refreshTokenStore;

	@MockitoBean
	private OAuth2LoginCodeStore loginCodeStore;

	@MockitoBean
	private RedissonClient redissonClient;

	@Test
	void startsGoogleAuthorizationWithFrontendStateInTheSession() throws Exception {
		MvcResult started = mockMvc.perform(get("/api/v1/auth/oauth2/google/start")
					.param("state", FRONTEND_STATE))
				.andExpect(status().isFound())
				.andExpect(header().string("Location", "/oauth2/authorization/google"))
				.andReturn();

		MockHttpSession session = (MockHttpSession) started.getRequest().getSession(false);
		assertThat(session).isNotNull();
		mockMvc.perform(get("/oauth2/authorization/google").session(session))
				.andExpect(status().is3xxRedirection())
				.andExpect(header().string("Location", containsString("accounts.google.com")));
	}

	@Test
	void rejectsInvalidFrontendStateBeforeGoogleRedirect() throws Exception {
		mockMvc.perform(get("/api/v1/auth/oauth2/google/start").param("state", "bad"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void exchangesLoginCodeOnceAndRejectsItsReplay() throws Exception {
		String code = "a".repeat(43);
		when(loginCodeStore.consume(code))
				.thenReturn(Optional.of(new Identity(15L, junsik.reservation.enums.MemberRole.USER)))
				.thenReturn(Optional.empty());
		String body = "{\"code\":\"" + code + "\"}";

		mockMvc.perform(post("/api/v1/auth/oauth2/exchange")
					.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.refreshToken").isNotEmpty())
				.andExpect(jsonPath("$.tokenType").value("Bearer"));
		mockMvc.perform(post("/api/v1/auth/oauth2/exchange")
					.contentType(MediaType.APPLICATION_JSON).content(body))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("AUTH_007"));
	}

	@Test
	void redirectsGoogleAuthorizationRequestUsingConfiguredClient() throws Exception {
		mockMvc.perform(get("/oauth2/authorization/google"))
				.andExpect(status().is3xxRedirection())
				.andExpect(header().string("Location", containsString("accounts.google.com")))
				.andExpect(header().string("Location", containsString("client_id=test-google-client-id")))
				.andExpect(header().string("Location", not(containsString("test-google-client-secret"))));
	}

	@Test
	void createsMemberAndSocialAccountOnFirstGoogleLogin() {
		OAuth2MemberPrincipal principal = provision("Social@Example.com", true);

		Member member = memberRepository.findByEmail(EMAIL).orElseThrow();
		SocialAccount socialAccount = socialAccountRepository
				.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, PROVIDER_USER_ID)
				.orElseThrow();

		assertThat(principal.getMemberId()).isEqualTo(member.getId());
		assertThat(principal.getRole().name()).isEqualTo("USER");
		assertThat(socialAccount.getMember().getId()).isEqualTo(member.getId());
		assertThat(passwordEncoder.matches("", member.getPassword())).isFalse();
	}

	@Test
	void linksGoogleAccountToExistingMemberWithVerifiedEmail() {
		String encodedPassword = passwordEncoder.encode("password123!");
		Member existingMember = memberRepository.saveAndFlush(member(EMAIL, encodedPassword));

		OAuth2MemberPrincipal principal = provision(EMAIL, true);

		assertThat(principal.getMemberId()).isEqualTo(existingMember.getId());
		assertThat(memberRepository.count()).isOne();
		assertThat(memberRepository.findById(existingMember.getId()).orElseThrow().getPassword())
				.isEqualTo(encodedPassword);
		assertThat(socialAccountRepository
				.findByProviderAndProviderUserId(OAuthProvider.GOOGLE, PROVIDER_USER_ID))
				.isPresent();
	}

	@Test
	void rejectsGoogleAccountWithoutVerifiedEmail() {
		assertThatThrownBy(() -> provision(EMAIL, false))
				.isInstanceOf(OAuth2AuthenticationException.class)
				.extracting(exception -> ((OAuth2AuthenticationException) exception).getError().getErrorCode())
				.isEqualTo("invalid_google_user_info");

		assertThat(memberRepository.count()).isZero();
		assertThat(socialAccountRepository.count()).isZero();
	}

	@Test
	void issuesServiceAccessTokenAfterOAuth2AuthenticationSuccess() throws Exception {
		OAuth2MemberPrincipal principal = provision(EMAIL, true);
		OAuth2AuthenticationToken authentication = new OAuth2AuthenticationToken(
				principal,
				principal.getAuthorities(),
				"google"
		);
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/login/oauth2/code/google");
		MockHttpServletResponse response = new MockHttpServletResponse();

		successHandler.onAuthenticationSuccess(request, response, authentication);

		String accessToken = JsonPath.read(response.getContentAsString(), "$.accessToken");
		String refreshToken = JsonPath.read(response.getContentAsString(), "$.refreshToken");
		Jwt jwt = jwtDecoder.decode(accessToken);
		Jwt refreshJwt = jwtDecoder.decode(refreshToken);
		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
		assertThat(JsonPath.<String>read(response.getContentAsString(), "$.tokenType")).isEqualTo("Bearer");
		assertThat(jwt.getSubject()).isEqualTo(principal.getMemberId().toString());
		assertThat(jwt.getClaimAsString("role")).isEqualTo("USER");
		assertThat(jwt.getClaimAsString("token_type")).isEqualTo("ACCESS");
		assertThat(refreshJwt.getClaimAsString("token_type")).isEqualTo("REFRESH");
	}

	@Test
	void redirectsFrontendWithOneTimeCodeWithoutExposingTokens() throws Exception {
		OAuth2MemberPrincipal principal = provision(EMAIL, true);
		OAuth2AuthenticationToken authentication = new OAuth2AuthenticationToken(
				principal, principal.getAuthorities(), "google");
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/login/oauth2/code/google");
		frontendFlow.begin(request, FRONTEND_STATE);
		MockHttpServletResponse response = new MockHttpServletResponse();

		successHandler.onAuthenticationSuccess(request, response, authentication);

		assertThat(response.getStatus()).isEqualTo(302);
		assertThat(response.getRedirectedUrl())
				.startsWith("http://localhost:5173/oauth2/callback#code=")
				.contains("&state=" + FRONTEND_STATE)
				.doesNotContain("accessToken", "refreshToken");
		assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
		verifyNoInteractions(refreshTokenStore);
	}

	@Test
	void redirectsFrontendAfterGoogleConsentCancellation() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/login/oauth2/code/google");
		frontendFlow.begin(request, FRONTEND_STATE);
		MockHttpServletResponse response = new MockHttpServletResponse();

		failureHandler.onAuthenticationFailure(request, response,
				new OAuth2AuthenticationException(new OAuth2Error("access_denied")));

		assertThat(response.getStatus()).isEqualTo(302);
		assertThat(response.getRedirectedUrl()).isEqualTo(
				"http://localhost:5173/oauth2/callback#error=cancelled&state=" + FRONTEND_STATE);
	}

	@Test
	void redirectsFrontendAfterGoogleAuthenticationFailure() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/login/oauth2/code/google");
		frontendFlow.begin(request, FRONTEND_STATE);
		MockHttpServletResponse response = new MockHttpServletResponse();

		failureHandler.onAuthenticationFailure(request, response,
				new OAuth2AuthenticationException(new OAuth2Error("invalid_user_info")));

		assertThat(response.getStatus()).isEqualTo(302);
		assertThat(response.getRedirectedUrl()).isEqualTo(
				"http://localhost:5173/oauth2/callback#error=failed&state=" + FRONTEND_STATE);
	}

	@Test
	void returnsConsistentErrorWhenOAuth2AuthenticationFails() throws Exception {
		MockHttpServletRequest request = new MockHttpServletRequest("GET", "/login/oauth2/code/google");
		MockHttpServletResponse response = new MockHttpServletResponse();

		failureHandler.onAuthenticationFailure(
				request,
				response,
				new OAuth2AuthenticationException(new OAuth2Error("access_denied"))
		);

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(JsonPath.<Integer>read(response.getContentAsString(), "$.status")).isEqualTo(401);
		assertThat(JsonPath.<String>read(response.getContentAsString(), "$.code")).isEqualTo("AUTH_004");
		assertThat(JsonPath.<String>read(response.getContentAsString(), "$.message"))
				.isEqualTo("소셜 로그인에 실패했습니다.");
		assertThat(JsonPath.<String>read(response.getContentAsString(), "$.path"))
				.isEqualTo("/login/oauth2/code/google");
	}

	private OAuth2MemberPrincipal provision(String email, boolean emailVerified) {
		return oauth2MemberService.provisionMember(
				OAuthProvider.GOOGLE,
				Map.of(
						"sub", PROVIDER_USER_ID,
						"email", email,
						"email_verified", emailVerified,
						"name", "Social Member"
				)
		);
	}
}
