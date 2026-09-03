package junsik.reservation.controller;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.LoginRequest;
import junsik.reservation.dto.LoginResponse;
import junsik.reservation.dto.RefreshTokenRequest;
import junsik.reservation.dto.ReissueTokenResponse;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.security.MemberPrincipal;
import junsik.reservation.service.LoginService;
import junsik.reservation.service.TokenService;

@Tag(name = "Authentication", description = "인증 API")
@ApiResponses({
		@ApiResponse(
				responseCode = "400",
				description = "입력값 또는 요청 형식 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "401",
				description = "인증 실패 또는 유효하지 않은 Token",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		),
		@ApiResponse(
				responseCode = "500",
				description = "서버 내부 오류",
				content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ErrorResponse.class))
		)
})
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

	private final LoginService loginService;
	private final TokenService tokenService;

	public AuthController(LoginService loginService, TokenService tokenService) {
		this.loginService = loginService;
		this.tokenService = tokenService;
	}

	@Operation(summary = "이메일 로그인 및 JWT Access/Refresh Token 발급")
	@PostMapping("/login")
	public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
		return ResponseEntity.ok(loginService.login(request));
	}

	@Operation(summary = "Refresh Token 기반 Access Token 재발급")
	@PostMapping("/reissue")
	public ResponseEntity<ReissueTokenResponse> reissue(@Valid @RequestBody RefreshTokenRequest request) {
		return ResponseEntity.ok(tokenService.reissue(request.refreshToken()));
	}

	@Operation(summary = "로그아웃", description = "Redis에서 Refresh Token을 제거합니다.")
	@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
	@PostMapping("/logout")
	public ResponseEntity<Void> logout(@AuthenticationPrincipal MemberPrincipal principal) {
		tokenService.logout(principal.memberId());
		return ResponseEntity.noContent().build();
	}
}
