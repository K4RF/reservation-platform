package junsik.reservation.controller;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.dto.LoginRequest;
import junsik.reservation.dto.LoginResponse;
import junsik.reservation.service.LoginService;

@Tag(name = "Authentication", description = "인증 API")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

	private final LoginService loginService;

	public AuthController(LoginService loginService) {
		this.loginService = loginService;
	}

	@Operation(summary = "이메일 로그인 및 JWT Access Token 발급")
	@PostMapping("/login")
	public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
		return ResponseEntity.ok(loginService.login(request));
	}
}
