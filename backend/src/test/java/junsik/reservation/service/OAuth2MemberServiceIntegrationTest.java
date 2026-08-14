package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Member;
import junsik.reservation.entity.SocialAccount;
import junsik.reservation.enums.OAuthProvider;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.SocialAccountRepository;
import junsik.reservation.security.OAuth2AuthenticationFailureHandler;
import junsik.reservation.security.OAuth2AuthenticationSuccessHandler;
import junsik.reservation.security.OAuth2MemberPrincipal;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OAuth2MemberServiceIntegrationTest {

	private static final String PROVIDER_USER_ID = "google-user-123";
	private static final String EMAIL = "social@example.com";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private OAuth2MemberService oauth2MemberService;

	@Autowired
	private OAuth2AuthenticationSuccessHandler successHandler;

	@Autowired
	private OAuth2AuthenticationFailureHandler failureHandler;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private SocialAccountRepository socialAccountRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtDecoder jwtDecoder;

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
		Member existingMember = memberRepository.saveAndFlush(Member.createUser(EMAIL, encodedPassword));

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
		Jwt jwt = jwtDecoder.decode(accessToken);
		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(JsonPath.<String>read(response.getContentAsString(), "$.tokenType")).isEqualTo("Bearer");
		assertThat(jwt.getSubject()).isEqualTo(principal.getMemberId().toString());
		assertThat(jwt.getClaimAsString("role")).isEqualTo("USER");
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
