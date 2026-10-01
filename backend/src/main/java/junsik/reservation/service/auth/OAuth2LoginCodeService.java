package junsik.reservation.service.auth;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import junsik.reservation.dto.auth.response.LoginResponse;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.SecurityErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.OAuth2LoginCodeStore;
import junsik.reservation.repository.OAuth2LoginCodeStore.Identity;

@Service
public class OAuth2LoginCodeService {

	private static final Duration TTL = Duration.ofSeconds(60);
	private static final Pattern CODE_PATTERN = Pattern.compile("[A-Za-z0-9_-]{43}");
	private final SecureRandom secureRandom = new SecureRandom();
	private final OAuth2LoginCodeStore store;
	private final TokenService tokenService;

	public OAuth2LoginCodeService(OAuth2LoginCodeStore store, TokenService tokenService) {
		this.store = store;
		this.tokenService = tokenService;
	}

	public String issue(Long memberId, MemberRole role) {
		byte[] bytes = new byte[32];
		secureRandom.nextBytes(bytes);
		String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		store.save(code, new Identity(memberId, role), TTL);
		return code;
	}

	public LoginResponse exchange(String code) {
		if (code == null || !CODE_PATTERN.matcher(code).matches()) {
			throw new BusinessException(SecurityErrorCode.INVALID_OAUTH2_LOGIN_CODE);
		}
		Identity identity = store.consume(code)
				.orElseThrow(() -> new BusinessException(SecurityErrorCode.INVALID_OAUTH2_LOGIN_CODE));
		return tokenService.issueTokens(identity.memberId(), identity.role());
	}
}
