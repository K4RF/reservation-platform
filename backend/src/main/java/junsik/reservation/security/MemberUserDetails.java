package junsik.reservation.security;

import java.util.Collection;
import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import junsik.reservation.entity.Member;
import junsik.reservation.enums.MemberRole;

public class MemberUserDetails implements UserDetails {

	private final Long memberId;
	private final String email;
	private final String password;
	private final MemberRole role;

	private MemberUserDetails(Long memberId, String email, String password, MemberRole role) {
		this.memberId = memberId;
		this.email = email;
		this.password = password;
		this.role = role;
	}

	public static MemberUserDetails from(Member member) {
		return new MemberUserDetails(
				member.getId(),
				member.getEmail(),
				member.getPassword(),
				member.getRole()
		);
	}

	public Long getMemberId() {
		return memberId;
	}

	public MemberRole getRole() {
		return role;
	}

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
	}

	@Override
	public String getPassword() {
		return password;
	}

	@Override
	public String getUsername() {
		return email;
	}
}
