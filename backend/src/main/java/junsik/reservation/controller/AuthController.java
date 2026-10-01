package junsik.reservation.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.config.OpenApiConfig;
import junsik.reservation.dto.auth.request.LoginRequest;
import junsik.reservation.dto.auth.request.OAuth2LoginCodeRequest;
import junsik.reservation.dto.auth.request.RefreshTokenRequest;
import junsik.reservation.dto.auth.response.LoginResponse;
import junsik.reservation.dto.auth.response.ReissueTokenResponse;
import junsik.reservation.global.exception.ErrorResponse;
import junsik.reservation.security.MemberPrincipal;
import junsik.reservation.security.OAuth2FrontendFlow;
import junsik.reservation.service.auth.LoginService;
import junsik.reservation.service.auth.OAuth2LoginCodeService;
import junsik.reservation.service.auth.TokenService;

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
	private final OAuth2FrontendFlow frontendFlow;
	private final OAuth2LoginCodeService loginCodeService;

	public AuthController(LoginService loginService, TokenService tokenService,
			OAuth2FrontendFlow frontendFlow, OAuth2LoginCodeService loginCodeService) {
		this.loginService = loginService;
		this.tokenService = tokenService;
		this.frontendFlow = frontendFlow;
		this.loginCodeService = loginCodeService;
	}

	@Operation(summary = "이메일 로그인 및 JWT Access/Refresh Token 발급")
	@PostMapping("/login")
	public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
		return ResponseEntity.ok(loginService.login(request));
	}

	@Operation(summary = "Google OAuth2 로그인 시작")
	@GetMapping("/oauth2/google/start")
	public ResponseEntity<Void> startGoogleLogin(@RequestParam String state, HttpServletRequest request) {
		frontendFlow.begin(request, state);
		return ResponseEntity.status(302)
				.header(HttpHeaders.LOCATION, "/oauth2/authorization/google")
				.header(HttpHeaders.CACHE_CONTROL, "no-store")
				.build();
	}

	@Operation(summary = "일회용 Google OAuth2 로그인 코드 교환")
	@PostMapping("/oauth2/exchange")
	public ResponseEntity<LoginResponse> exchangeOAuth2Code(@Valid @RequestBody OAuth2LoginCodeRequest request) {
		return ResponseEntity.ok()
				.header(HttpHeaders.CACHE_CONTROL, "no-store")
				.body(loginCodeService.exchange(request.code()));
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
