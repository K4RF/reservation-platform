package junsik.reservation.service;

import java.util.Locale;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.stereotype.Service;

import junsik.reservation.dto.LoginRequest;
import junsik.reservation.dto.LoginResponse;
import junsik.reservation.enums.SecurityErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.security.MemberUserDetails;

@Service
public class LoginService {

	private final AuthenticationManager authenticationManager;
	private final TokenService tokenService;

	public LoginService(AuthenticationManager authenticationManager, TokenService tokenService) {
		this.authenticationManager = authenticationManager;
		this.tokenService = tokenService;
	}

	public LoginResponse login(LoginRequest request) {
		String normalizedEmail = request.email().toLowerCase(Locale.ROOT);

		try {
			Authentication authentication = authenticationManager.authenticate(
					UsernamePasswordAuthenticationToken.unauthenticated(normalizedEmail, request.password())
			);
			MemberUserDetails principal = (MemberUserDetails) authentication.getPrincipal();
			return tokenService.issueTokens(principal.getMemberId(), principal.getRole());
		} catch (AuthenticationException exception) {
			throw new BusinessException(SecurityErrorCode.INVALID_CREDENTIALS);
		}
	}
}
