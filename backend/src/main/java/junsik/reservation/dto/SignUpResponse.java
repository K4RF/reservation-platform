package junsik.reservation.dto;

import junsik.reservation.entity.Member;
import junsik.reservation.enums.MemberRole;

public record SignUpResponse(
		Long memberId,
		String email,
		MemberRole role
) {

	public static SignUpResponse from(Member member) {
		return new SignUpResponse(member.getId(), member.getEmail(), member.getRole());
	}
}
