package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import junsik.reservation.dto.SignUpRequest;
import junsik.reservation.dto.SignUpResponse;
import junsik.reservation.service.MemberService;

@Tag(name = "Members", description = "회원 API")
@RestController
@RequestMapping("/api/v1/members")
public class MemberController {

	private final MemberService memberService;

	public MemberController(MemberService memberService) {
		this.memberService = memberService;
	}

	@Operation(
			summary = "회원가입",
			responses = @ApiResponse(
					responseCode = "201",
					description = "회원가입 성공",
					content = @Content(
							mediaType = MediaType.APPLICATION_JSON_VALUE,
							schema = @Schema(implementation = SignUpResponse.class)
					)
			)
	)
	@PostMapping
	public ResponseEntity<SignUpResponse> signUp(@Valid @RequestBody SignUpRequest request) {
		SignUpResponse response = memberService.signUp(request);
		return ResponseEntity
				.created(URI.create("/api/v1/members/" + response.memberId()))
				.body(response);
	}
}
