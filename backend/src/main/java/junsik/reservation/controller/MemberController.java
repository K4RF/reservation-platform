package junsik.reservation.controller;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import junsik.reservation.dto.SignUpRequest;
import junsik.reservation.dto.SignUpResponse;
import junsik.reservation.service.MemberService;

@RestController
@RequestMapping("/api/v1/members")
public class MemberController {

	private final MemberService memberService;

	public MemberController(MemberService memberService) {
		this.memberService = memberService;
	}

	@PostMapping
	public ResponseEntity<SignUpResponse> signUp(@Valid @RequestBody SignUpRequest request) {
		SignUpResponse response = memberService.signUp(request);
		return ResponseEntity
				.created(URI.create("/api/v1/members/" + response.memberId()))
				.body(response);
	}
}
