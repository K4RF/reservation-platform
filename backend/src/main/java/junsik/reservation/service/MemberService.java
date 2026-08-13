package junsik.reservation.service;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.SignUpRequest;
import junsik.reservation.dto.SignUpResponse;
import junsik.reservation.entity.Member;
import junsik.reservation.enums.MemberErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.MemberRepository;

@Service
public class MemberService {

	private final MemberRepository memberRepository;
	private final PasswordEncoder passwordEncoder;

	public MemberService(MemberRepository memberRepository, PasswordEncoder passwordEncoder) {
		this.memberRepository = memberRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional
	public SignUpResponse signUp(SignUpRequest request) {
		String normalizedEmail = request.email().toLowerCase(Locale.ROOT);

		if (memberRepository.existsByEmail(normalizedEmail)) {
			throw new BusinessException(MemberErrorCode.DUPLICATE_EMAIL);
		}

		Member member = Member.createUser(normalizedEmail, passwordEncoder.encode(request.password()));

		try {
			return SignUpResponse.from(memberRepository.saveAndFlush(member));
		} catch (DataIntegrityViolationException exception) {
			throw new BusinessException(MemberErrorCode.DUPLICATE_EMAIL);
		}
	}
}
