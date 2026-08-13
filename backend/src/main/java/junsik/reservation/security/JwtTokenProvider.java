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
		Instant issuedAt = clock.instant();
		Instant expiresAt = issuedAt.plus(properties.accessTokenExpiration());
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(properties.issuer())
				.issuedAt(issuedAt)
				.expiresAt(expiresAt)
				.subject(memberId.toString())
				.claim(ROLE_CLAIM, role.name())
				.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256)
				.type("JWT")
				.build();

		return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}

	public Authentication getAuthentication(String token) {
		Jwt jwt = jwtDecoder.decode(token);
		Long memberId = Long.valueOf(jwt.getSubject());
		MemberRole role = MemberRole.valueOf(jwt.getClaimAsString(ROLE_CLAIM));
		MemberPrincipal principal = new MemberPrincipal(memberId, role);
		List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));

		return UsernamePasswordAuthenticationToken.authenticated(principal, null, authorities);
	}
}
