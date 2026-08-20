package junsik.reservation.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.stereotype.Service;

import junsik.reservation.dto.LoginResponse;
import junsik.reservation.dto.ReissueTokenResponse;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.SecurityErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.RefreshTokenStore;
import junsik.reservation.security.JwtProperties;
import junsik.reservation.security.JwtTokenProvider;
import junsik.reservation.security.JwtTokenProvider.RefreshTokenPrincipal;

@Service
public class TokenService {

	private final JwtTokenProvider jwtTokenProvider;
	private final JwtProperties jwtProperties;
	private final RefreshTokenStore refreshTokenStore;

	public TokenService(
			JwtTokenProvider jwtTokenProvider,
			JwtProperties jwtProperties,
			RefreshTokenStore refreshTokenStore
	) {
		this.jwtTokenProvider = jwtTokenProvider;
		this.jwtProperties = jwtProperties;
		this.refreshTokenStore = refreshTokenStore;
	}

	public LoginResponse issueTokens(Long memberId, MemberRole role) {
		String accessToken = jwtTokenProvider.createAccessToken(memberId, role);
		String refreshToken = jwtTokenProvider.createRefreshToken(memberId, role);
		refreshTokenStore.save(memberId, refreshToken, jwtProperties.refreshTokenExpiration());
		return LoginResponse.bearer(accessToken, refreshToken);
	}

	public ReissueTokenResponse reissue(String refreshToken) {
		RefreshTokenPrincipal principal;
		try {
			principal = jwtTokenProvider.parseRefreshToken(refreshToken);
		} catch (RuntimeException exception) {
			throw new BusinessException(SecurityErrorCode.INVALID_REFRESH_TOKEN);
		}

		String storedToken = refreshTokenStore.findByMemberId(principal.memberId())
				.orElseThrow(() -> new BusinessException(SecurityErrorCode.REFRESH_TOKEN_NOT_FOUND));
		if (!matches(storedToken, refreshToken)) {
			throw new BusinessException(SecurityErrorCode.REFRESH_TOKEN_NOT_FOUND);
		}

		String accessToken = jwtTokenProvider.createAccessToken(principal.memberId(), principal.role());
		return ReissueTokenResponse.bearer(accessToken);
	}

	public void logout(Long memberId) {
		if (refreshTokenStore.findByMemberId(memberId).isEmpty()) {
			throw new BusinessException(SecurityErrorCode.REFRESH_TOKEN_NOT_FOUND);
		}
		refreshTokenStore.delete(memberId);
	}

	private boolean matches(String storedToken, String requestedToken) {
		return MessageDigest.isEqual(
				storedToken.getBytes(StandardCharsets.UTF_8),
				requestedToken.getBytes(StandardCharsets.UTF_8)
		);
	}
}
