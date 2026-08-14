package junsik.reservation.service;

import java.util.Map;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.converter.GoogleOAuth2UserInfo;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.SocialAccount;
import junsik.reservation.enums.OAuthProvider;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.SocialAccountRepository;
import junsik.reservation.security.OAuth2MemberPrincipal;

@Service
public class OAuth2MemberService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

	private final DefaultOAuth2UserService delegate;
	private final MemberRepository memberRepository;
	private final SocialAccountRepository socialAccountRepository;
	private final PasswordEncoder passwordEncoder;

	public OAuth2MemberService(
			MemberRepository memberRepository,
			SocialAccountRepository socialAccountRepository,
			PasswordEncoder passwordEncoder
	) {
		this.delegate = new DefaultOAuth2UserService();
		this.memberRepository = memberRepository;
		this.socialAccountRepository = socialAccountRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Override
	@Transactional
	public OAuth2User loadUser(OAuth2UserRequest userRequest) {
		OAuth2User oauth2User = delegate.loadUser(userRequest);
		OAuthProvider provider = OAuthProvider.fromRegistrationId(
				userRequest.getClientRegistration().getRegistrationId()
		);
		return provisionMember(provider, oauth2User.getAttributes());
	}

	@Transactional
	public OAuth2MemberPrincipal provisionMember(OAuthProvider provider, Map<String, Object> attributes) {
		if (provider != OAuthProvider.GOOGLE) {
			throw new IllegalArgumentException("Unsupported OAuth2 provider: " + provider);
		}

		GoogleOAuth2UserInfo userInfo = GoogleOAuth2UserInfo.from(attributes);
		Member member = socialAccountRepository
				.findByProviderAndProviderUserId(provider, userInfo.providerUserId())
				.map(SocialAccount::getMember)
				.orElseGet(() -> linkSocialAccount(provider, userInfo));

		return OAuth2MemberPrincipal.of(member, userInfo.providerUserId(), attributes);
	}

	private Member linkSocialAccount(OAuthProvider provider, GoogleOAuth2UserInfo userInfo) {
		Member member = memberRepository.findByEmail(userInfo.email())
				.orElseGet(() -> createSocialMember(userInfo.email()));
		socialAccountRepository.saveAndFlush(
				SocialAccount.create(member, provider, userInfo.providerUserId())
		);
		return member;
	}

	private Member createSocialMember(String email) {
		String inaccessiblePassword = passwordEncoder.encode(UUID.randomUUID().toString());
		return memberRepository.saveAndFlush(Member.createUser(email, inaccessiblePassword));
	}
}
