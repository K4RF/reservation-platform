package junsik.reservation.security;

import junsik.reservation.enums.MemberRole;

public record MemberPrincipal(Long memberId, MemberRole role) {
}
