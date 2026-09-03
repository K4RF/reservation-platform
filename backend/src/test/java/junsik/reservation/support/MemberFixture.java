package junsik.reservation.support;

import junsik.reservation.entity.Member;

public final class MemberFixture {

	public static final String DEFAULT_EMAIL = "member@example.com";
	public static final String DEFAULT_ENCODED_PASSWORD = "encoded-password";

	private MemberFixture() {
	}

	public static Member member() {
		return member(DEFAULT_EMAIL);
	}

	public static Member member(String email) {
		return member(email, DEFAULT_ENCODED_PASSWORD);
	}

	public static Member member(String email, String encodedPassword) {
		return Member.createUser(email, encodedPassword);
	}
}
