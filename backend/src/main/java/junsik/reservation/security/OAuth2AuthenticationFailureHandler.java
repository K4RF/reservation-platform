package junsik.reservation.security;

import java.io.IOException;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;

import junsik.reservation.enums.SecurityErrorCode;

@Component
public class OAuth2AuthenticationFailureHandler implements AuthenticationFailureHandler {

	private final SecurityErrorResponseWriter errorResponseWriter;
	private final OAuth2FrontendFlow frontendFlow;

	public OAuth2AuthenticationFailureHandler(SecurityErrorResponseWriter errorResponseWriter,
			OAuth2FrontendFlow frontendFlow) {
		this.errorResponseWriter = errorResponseWriter;
		this.frontendFlow = frontendFlow;
	}

	@Override
	public void onAuthenticationFailure(
			HttpServletRequest request,
			HttpServletResponse response,
			AuthenticationException exception
	) throws IOException, ServletException {
		SecurityContextHolder.clearContext();
		var frontendState = frontendFlow.consumeState(request);
		if (frontendState.isPresent()) {
			boolean cancelled = exception instanceof OAuth2AuthenticationException oauthError
					&& "access_denied".equals(oauthError.getError().getErrorCode());
			response.setHeader("Cache-Control", "no-store");
			response.sendRedirect(frontendFlow.failureUrl(cancelled, frontendState.get()));
			return;
		}
		errorResponseWriter.write(request, response, SecurityErrorCode.OAUTH2_AUTHENTICATION_FAILED);
	}
}
