package junsik.reservation.service.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import junsik.reservation.dto.auth.response.LoginResponse;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.SecurityErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.OAuth2LoginCodeStore;
import junsik.reservation.repository.OAuth2LoginCodeStore.Identity;

class OAuth2LoginCodeServiceTest {

	private final OAuth2LoginCodeStore store = mock(OAuth2LoginCodeStore.class);
	private final TokenService tokenService = mock(TokenService.class);
	private final OAuth2LoginCodeService service = new OAuth2LoginCodeService(store, tokenService);

	@Test
	void issuesRandomShortLivedCodesWithoutIssuingTokensInTheRedirect() {
		String first = service.issue(12L, MemberRole.USER);
		String second = service.issue(12L, MemberRole.USER);

		assertThat(first).matches("[A-Za-z0-9_-]{43}").isNotEqualTo(second);
		verify(store).save(eq(first), eq(new Identity(12L, MemberRole.USER)), eq(Duration.ofSeconds(60)));
		verify(store).save(eq(second), eq(new Identity(12L, MemberRole.USER)), eq(Duration.ofSeconds(60)));
	}

	@Test
	void exchangesAConsumedCodeForTheSameLoginResponseAsEmailLogin() {
		String code = "a".repeat(43);
		when(store.consume(code)).thenReturn(Optional.of(new Identity(12L, MemberRole.USER)));
		LoginResponse tokens = LoginResponse.bearer("access", "refresh");
		when(tokenService.issueTokens(12L, MemberRole.USER)).thenReturn(tokens);

		assertThat(service.exchange(code)).isEqualTo(tokens);
	}

	@Test
	void rejectsMalformedMissingAndReplayedCodes() {
		String code = "a".repeat(43);
		when(store.consume(code)).thenReturn(Optional.empty());

		for (String invalid : new String[] {"short", code}) {
			assertThatThrownBy(() -> service.exchange(invalid))
					.isInstanceOf(BusinessException.class)
					.extracting(exception -> ((BusinessException) exception).getErrorCode())
					.isEqualTo(SecurityErrorCode.INVALID_OAUTH2_LOGIN_CODE);
		}
	}
}
