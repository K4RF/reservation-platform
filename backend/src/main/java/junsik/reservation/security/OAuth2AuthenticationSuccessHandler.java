package junsik.reservation.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import junsik.reservation.dto.auth.response.LoginResponse;
import junsik.reservation.service.auth.OAuth2LoginCodeService;
import junsik.reservation.service.auth.TokenService;
import tools.jackson.databind.ObjectMapper;

@Component
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

	private final TokenService tokenService;
	private final ObjectMapper objectMapper;
	private final OAuth2LoginCodeService loginCodeService;
	private final OAuth2FrontendFlow frontendFlow;

	public OAuth2AuthenticationSuccessHandler(TokenService tokenService, ObjectMapper objectMapper,
			OAuth2LoginCodeService loginCodeService, OAuth2FrontendFlow frontendFlow) {
		this.tokenService = tokenService;
		this.objectMapper = objectMapper;
		this.loginCodeService = loginCodeService;
		this.frontendFlow = frontendFlow;
	}

	@Override
	public void onAuthenticationSuccess(
			HttpServletRequest request,
			HttpServletResponse response,
			Authentication authentication
	) throws IOException, ServletException {
		OAuth2MemberPrincipal principal = (OAuth2MemberPrincipal) authentication.getPrincipal();
		var frontendState = frontendFlow.consumeState(request);
		if (frontendState.isPresent()) {
			String code = loginCodeService.issue(principal.getMemberId(), principal.getRole());
			response.setHeader("Cache-Control", "no-store");
			response.sendRedirect(frontendFlow.successUrl(code, frontendState.get()));
			return;
		}
		LoginResponse tokens = tokenService.issueTokens(principal.getMemberId(), principal.getRole());

		response.setStatus(HttpServletResponse.SC_OK);
		response.setHeader("Cache-Control", "no-store");
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		objectMapper.writeValue(response.getOutputStream(), tokens);
	}
}
