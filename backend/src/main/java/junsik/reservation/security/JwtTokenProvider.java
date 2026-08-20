package junsik.reservation.security;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Component;

import junsik.reservation.enums.MemberRole;

@Component
public class JwtTokenProvider {

	private static final String ROLE_CLAIM = "role";
	private static final String TOKEN_TYPE_CLAIM = "token_type";
	private static final String ACCESS_TOKEN_TYPE = "ACCESS";
	private static final String REFRESH_TOKEN_TYPE = "REFRESH";

	private final JwtEncoder jwtEncoder;
	private final JwtDecoder jwtDecoder;
	private final JwtProperties properties;
	private final Clock clock;

	public JwtTokenProvider(
			JwtEncoder jwtEncoder,
			JwtDecoder jwtDecoder,
			JwtProperties properties,
			Clock clock
	) {
		this.jwtEncoder = jwtEncoder;
		this.jwtDecoder = jwtDecoder;
		this.properties = properties;
		this.clock = clock;
	}

	public String createAccessToken(Long memberId, MemberRole role) {
		return createToken(memberId, role, ACCESS_TOKEN_TYPE, properties.accessTokenExpiration());
	}

	public String createRefreshToken(Long memberId, MemberRole role) {
		return createToken(memberId, role, REFRESH_TOKEN_TYPE, properties.refreshTokenExpiration());
	}

	private String createToken(Long memberId, MemberRole role, String tokenType, java.time.Duration expiration) {
		Instant issuedAt = clock.instant();
		Instant expiresAt = issuedAt.plus(expiration);
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(properties.issuer())
				.issuedAt(issuedAt)
				.expiresAt(expiresAt)
				.subject(memberId.toString())
				.claim(ROLE_CLAIM, role.name())
				.claim(TOKEN_TYPE_CLAIM, tokenType)
				.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256)
				.type("JWT")
				.build();

		return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}

	public Authentication getAuthentication(String token) {
		Jwt jwt = jwtDecoder.decode(token);
		validateTokenType(jwt, ACCESS_TOKEN_TYPE);
		Long memberId = Long.valueOf(jwt.getSubject());
		MemberRole role = MemberRole.valueOf(jwt.getClaimAsString(ROLE_CLAIM));
		MemberPrincipal principal = new MemberPrincipal(memberId, role);
		List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));

		return UsernamePasswordAuthenticationToken.authenticated(principal, null, authorities);
	}

	public RefreshTokenPrincipal parseRefreshToken(String token) {
		Jwt jwt = jwtDecoder.decode(token);
		validateTokenType(jwt, REFRESH_TOKEN_TYPE);
		return new RefreshTokenPrincipal(
				Long.valueOf(jwt.getSubject()),
				MemberRole.valueOf(jwt.getClaimAsString(ROLE_CLAIM))
		);
	}

	private void validateTokenType(Jwt jwt, String expectedType) {
		if (!expectedType.equals(jwt.getClaimAsString(TOKEN_TYPE_CLAIM))) {
			throw new org.springframework.security.oauth2.jwt.JwtException("Unexpected JWT token type");
		}
	}

	public record RefreshTokenPrincipal(Long memberId, MemberRole role) {
	}
}
