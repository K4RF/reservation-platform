package junsik.reservation.security;

import java.io.IOException;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import junsik.reservation.enums.SecurityErrorCode;

@Component
public class OAuth2AuthenticationFailureHandler implements AuthenticationFailureHandler {

	private final SecurityErrorResponseWriter errorResponseWriter;

	public OAuth2AuthenticationFailureHandler(SecurityErrorResponseWriter errorResponseWriter) {
		this.errorResponseWriter = errorResponseWriter;
	}

	@Override
	public void onAuthenticationFailure(
			HttpServletRequest request,
			HttpServletResponse response,
			AuthenticationException exception
	) throws IOException, ServletException {
		SecurityContextHolder.clearContext();
		errorResponseWriter.write(request, response, SecurityErrorCode.OAUTH2_AUTHENTICATION_FAILED);
	}
}
