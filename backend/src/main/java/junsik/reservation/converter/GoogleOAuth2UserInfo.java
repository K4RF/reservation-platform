package junsik.reservation.converter;

import java.util.Locale;
import java.util.Map;

import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

public record GoogleOAuth2UserInfo(String providerUserId, String email) {

	private static final String INVALID_USER_INFO = "invalid_google_user_info";

	public static GoogleOAuth2UserInfo from(Map<String, Object> attributes) {
		String providerUserId = stringAttribute(attributes, "sub");
		String email = stringAttribute(attributes, "email");
		boolean emailVerified = Boolean.TRUE.equals(attributes.get("email_verified"));

		if (providerUserId == null || email == null || !emailVerified) {
			throw new OAuth2AuthenticationException(
					new OAuth2Error(INVALID_USER_INFO),
					"Google account must provide a verified email"
			);
		}

		return new GoogleOAuth2UserInfo(providerUserId, email.toLowerCase(Locale.ROOT));
	}

	private static String stringAttribute(Map<String, Object> attributes, String name) {
		Object value = attributes.get(name);
		if (!(value instanceof String text) || text.isBlank()) {
			return null;
		}
		return text;
	}
}
