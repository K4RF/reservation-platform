package junsik.reservation.security;

import java.net.URI;
import java.util.Optional;
import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.global.exception.CommonErrorCode;

@Component
public class OAuth2FrontendFlow {

	private static final String SESSION_KEY = OAuth2FrontendFlow.class.getName() + ".state";
	private static final Pattern STATE_PATTERN = Pattern.compile("[A-Za-z0-9_-]{32,128}");
	private final String callbackUrl;

	public OAuth2FrontendFlow(@Value("${reservation.oauth2.frontend-base-url}") String frontendBaseUrl) {
		URI origin = URI.create(frontendBaseUrl);
		if (!("http".equals(origin.getScheme()) || "https".equals(origin.getScheme()))
				|| origin.getHost() == null || origin.getRawQuery() != null
				|| origin.getRawFragment() != null || origin.getUserInfo() != null
				|| !(origin.getRawPath() == null || origin.getRawPath().isEmpty() || "/".equals(origin.getRawPath()))) {
			throw new IllegalArgumentException("OAuth2 frontend base URL must be an HTTP(S) origin");
		}
		this.callbackUrl = frontendBaseUrl.replaceAll("/+$", "") + "/oauth2/callback";
	}

	public void begin(HttpServletRequest request, String state) {
		if (state == null || !STATE_PATTERN.matcher(state).matches()) {
			throw new BusinessException(CommonErrorCode.INVALID_INPUT_VALUE);
		}
		request.getSession(true).setAttribute(SESSION_KEY, state);
	}

	public Optional<String> consumeState(HttpServletRequest request) {
		HttpSession session = request.getSession(false);
		if (session == null) return Optional.empty();
		Object state = session.getAttribute(SESSION_KEY);
		session.removeAttribute(SESSION_KEY);
		if (!(state instanceof String value) || !STATE_PATTERN.matcher(value).matches()) {
			return Optional.empty();
		}
		return Optional.of(value);
	}

	public String successUrl(String code, String state) {
		return callbackUrl + "#code=" + code + "&state=" + state;
	}

	public String failureUrl(boolean cancelled, String state) {
		return callbackUrl + "#error=" + (cancelled ? "cancelled" : "failed") + "&state=" + state;
	}
}
