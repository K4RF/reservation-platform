package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import junsik.reservation.entity.Member;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.RefreshTokenStore;
import junsik.reservation.security.MemberPrincipal;
import junsik.reservation.security.JwtProperties;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(LoginIntegrationTest.TestController.class)
class LoginIntegrationTest {

	private static final String LOGIN_URL = "/api/v1/auth/login";
	private static final String PROTECTED_URL = "/api/v1/login-test/protected";
	private static final String EMAIL = "member@example.com";
	private static final String PASSWORD = "password123!";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Autowired
	private JwtDecoder jwtDecoder;

	@Autowired
	private JwtProperties jwtProperties;

	@MockitoBean
	private RefreshTokenStore refreshTokenStore;

	@Test
	void logsInWithEmailIgnoringCaseAndIssuesAccessToken() throws Exception {
		Member member = saveMember();

		MvcResult result = performLogin("Member@Example.com", PASSWORD)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accessToken").isNotEmpty())
				.andExpect(jsonPath("$.refreshToken").isNotEmpty())
				.andExpect(jsonPath("$.tokenType").value("Bearer"))
				.andExpect(jsonPath("$.password").doesNotExist())
				.andReturn();

		String accessToken = JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
		String refreshToken = JsonPath.read(result.getResponse().getContentAsString(), "$.refreshToken");
		Jwt jwt = jwtDecoder.decode(accessToken);
		Jwt refreshJwt = jwtDecoder.decode(refreshToken);

		assertThat(jwt.getSubject()).isEqualTo(member.getId().toString());
		assertThat(jwt.getClaimAsString("role")).isEqualTo("USER");
		assertThat(jwt.getClaimAsString("token_type")).isEqualTo("ACCESS");
		assertThat(refreshJwt.getClaimAsString("token_type")).isEqualTo("REFRESH");
		assertThat(refreshJwt.getExpiresAt()).isAfter(jwt.getExpiresAt());
		verify(refreshTokenStore).save(
				eq(member.getId()),
				eq(refreshToken),
				eq(jwtProperties.refreshTokenExpiration())
		);
	}

	@Test
	void accessesProtectedEndpointWithIssuedAccessToken() throws Exception {
		Member member = saveMember();
		MvcResult loginResult = performLogin(EMAIL, PASSWORD)
				.andExpect(status().isOk())
				.andReturn();
		String accessToken = JsonPath.read(loginResult.getResponse().getContentAsString(), "$.accessToken");

		mockMvc.perform(get(PROTECTED_URL).header("Authorization", "Bearer " + accessToken))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.memberId").value(member.getId()))
				.andExpect(jsonPath("$.role").value("USER"));
	}

	@Test
	void returnsSameAuthenticationErrorForUnknownEmailAndWrongPassword() throws Exception {
		saveMember();

		MvcResult unknownEmailResult = performLogin("unknown@example.com", PASSWORD)
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.code").value("AUTH_003"))
				.andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 올바르지 않습니다."))
				.andExpect(jsonPath("$.path").value(LOGIN_URL))
				.andReturn();

		MvcResult wrongPasswordResult = performLogin(EMAIL, "wrong-password")
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.status").value(401))
				.andExpect(jsonPath("$.code").value("AUTH_003"))
				.andExpect(jsonPath("$.message").value("이메일 또는 비밀번호가 올바르지 않습니다."))
				.andExpect(jsonPath("$.path").value(LOGIN_URL))
				.andReturn();

		assertThat(errorSignature(unknownEmailResult)).isEqualTo(errorSignature(wrongPasswordResult));
	}

	@Test
	void rejectsInvalidLoginRequest() throws Exception {
		performLogin("invalid-email", "")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	@Test
	void rejectsOversizedLoginCredentials() throws Exception {
		performLogin("x".repeat(244) + "@example.com", "x".repeat(73))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors.length()").value(3))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("email", "email", "password")));
	}

	private Member saveMember() {
		String encodedPassword = passwordEncoder.encode(PASSWORD);
		return memberRepository.saveAndFlush(Member.createUser(EMAIL, encodedPassword));
	}

	private org.springframework.test.web.servlet.ResultActions performLogin(String email, String password)
			throws Exception {
		return mockMvc.perform(post(LOGIN_URL)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "email": "%s",
						  "password": "%s"
						}
						""".formatted(email, password)));
	}

	private Map<String, Object> errorSignature(MvcResult result) throws Exception {
		String response = result.getResponse().getContentAsString();
		return Map.of(
				"status", JsonPath.read(response, "$.status"),
				"code", JsonPath.read(response, "$.code"),
				"message", JsonPath.read(response, "$.message")
		);
	}

	@RestController
	static class TestController {

		@GetMapping(PROTECTED_URL)
		Map<String, Object> protectedEndpoint(@AuthenticationPrincipal MemberPrincipal principal) {
			return Map.of("memberId", principal.memberId(), "role", principal.role());
		}
	}
}
