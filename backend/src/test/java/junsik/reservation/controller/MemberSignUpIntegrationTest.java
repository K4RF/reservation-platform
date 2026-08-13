package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Member;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.MemberRepository;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MemberSignUpIntegrationTest {

	private static final String SIGN_UP_URL = "/api/v1/members";
	private static final String RAW_PASSWORD = "password123!";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private PasswordEncoder passwordEncoder;

	@Test
	void signsUpMemberWithEncodedPasswordAndUserRole() throws Exception {
		mockMvc.perform(post(SIGN_UP_URL)
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "email": "Member@Example.com",
							  "password": "password123!"
							}
							"""))
				.andExpect(status().isCreated())
				.andExpect(header().string("Location", org.hamcrest.Matchers.matchesPattern("/api/v1/members/\\d+")))
				.andExpect(jsonPath("$.memberId").isNumber())
				.andExpect(jsonPath("$.email").value("member@example.com"))
				.andExpect(jsonPath("$.role").value("USER"))
				.andExpect(jsonPath("$.password").doesNotExist());

		Member savedMember = memberRepository.findByEmail("member@example.com").orElseThrow();
		assertThat(savedMember.getPassword()).isNotEqualTo(RAW_PASSWORD);
		assertThat(passwordEncoder.matches(RAW_PASSWORD, savedMember.getPassword())).isTrue();
		assertThat(savedMember.getRole()).isEqualTo(MemberRole.USER);
	}

	@Test
	void rejectsDuplicateEmailIgnoringCase() throws Exception {
		performSignUp("member@example.com", RAW_PASSWORD)
				.andExpect(status().isCreated());

		performSignUp("MEMBER@example.com", RAW_PASSWORD)
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.code").value("MEMBER_001"))
				.andExpect(jsonPath("$.message").value("이미 가입된 이메일입니다."))
				.andExpect(jsonPath("$.path").value(SIGN_UP_URL));
	}

	@Test
	void rejectsInvalidEmailAndShortPassword() throws Exception {
		performSignUp("invalid-email", "short")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("email", "password")));

		assertThat(memberRepository.count()).isZero();
	}

	@Test
	void rejectsBlankRequiredValues() throws Exception {
		performSignUp("", "")
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("email", "password", "password")));

		assertThat(memberRepository.count()).isZero();
	}

	@Test
	void enforcesDatabaseUniqueConstraintOnEmail() {
		memberRepository.saveAndFlush(Member.createUser("member@example.com", "encoded-password-1"));

		assertThatThrownBy(() ->
				memberRepository.saveAndFlush(Member.createUser("member@example.com", "encoded-password-2"))
		).isInstanceOf(DataIntegrityViolationException.class);
	}

	private org.springframework.test.web.servlet.ResultActions performSignUp(String email, String password)
			throws Exception {
		return mockMvc.perform(post(SIGN_UP_URL)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "email": "%s",
						  "password": "%s"
						}
						""".formatted(email, password)));
	}
}
