package junsik.reservation.enums;

import java.util.Locale;

import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

public enum OAuthProvider {

	GOOGLE;

	public static OAuthProvider fromRegistrationId(String registrationId) {
		try {
			return valueOf(registrationId.toUpperCase(Locale.ROOT));
		} catch (IllegalArgumentException exception) {
			throw new OAuth2AuthenticationException(
					new OAuth2Error("unsupported_oauth2_provider"),
					"Unsupported OAuth2 provider"
			);
		}
	}
}
