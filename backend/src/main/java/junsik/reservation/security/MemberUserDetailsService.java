package junsik.reservation.security;

import java.util.Locale;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.repository.MemberRepository;

@Service
public class MemberUserDetailsService implements UserDetailsService {

	private final MemberRepository memberRepository;

	public MemberUserDetailsService(MemberRepository memberRepository) {
		this.memberRepository = memberRepository;
	}

	@Override
	@Transactional(readOnly = true)
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		String normalizedEmail = email.toLowerCase(Locale.ROOT);
		return memberRepository.findByEmail(normalizedEmail)
				.map(MemberUserDetails::from)
				.orElseThrow(() -> new UsernameNotFoundException("Member not found"));
	}
}
