package junsik.reservation.support;

import junsik.reservation.enums.MemberRole;
import junsik.reservation.security.JwtTokenProvider;

public final class AuthenticationTestSupport {

	private static final long DEFAULT_MEMBER_ID = 1L;

	private AuthenticationTestSupport() {
	}

	public static String bearerToken(JwtTokenProvider tokenProvider, MemberRole role) {
		return bearerToken(tokenProvider, DEFAULT_MEMBER_ID, role);
	}

	public static String bearerToken(
			JwtTokenProvider tokenProvider,
			Long memberId,
			MemberRole role
	) {
		return bearer(tokenProvider.createAccessToken(memberId, role));
	}

	public static String bearer(String token) {
		return "Bearer " + token;
	}
}
