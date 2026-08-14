package junsik.reservation.security;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import junsik.reservation.entity.Member;
import junsik.reservation.enums.MemberRole;

public class OAuth2MemberPrincipal implements OAuth2User {

	private final Long memberId;
	private final MemberRole role;
	private final String providerUserId;
	private final Map<String, Object> attributes;

	private OAuth2MemberPrincipal(
			Long memberId,
			MemberRole role,
			String providerUserId,
			Map<String, Object> attributes
	) {
		this.memberId = memberId;
		this.role = role;
		this.providerUserId = providerUserId;
		this.attributes = Collections.unmodifiableMap(new LinkedHashMap<>(attributes));
	}

	public static OAuth2MemberPrincipal of(
			Member member,
			String providerUserId,
			Map<String, Object> attributes
	) {
		return new OAuth2MemberPrincipal(member.getId(), member.getRole(), providerUserId, attributes);
	}

	public Long getMemberId() {
		return memberId;
	}

	public MemberRole getRole() {
		return role;
	}

	@Override
	public Map<String, Object> getAttributes() {
		return attributes;
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
	}

	@Override
	public String getName() {
		return providerUserId;
	}
}
