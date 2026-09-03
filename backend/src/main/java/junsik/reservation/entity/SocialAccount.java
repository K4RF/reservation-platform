package junsik.reservation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import junsik.reservation.enums.OAuthProvider;

@Entity
@Table(
		name = "social_accounts",
		uniqueConstraints = {
				@UniqueConstraint(
						name = "uk_social_accounts_provider_user",
						columnNames = {"provider", "provider_user_id"}
				),
				@UniqueConstraint(
						name = "uk_social_accounts_member_provider",
						columnNames = {"member_id", "provider"}
				)
		},
		check = @CheckConstraint(
				name = "chk_social_accounts_provider_user_id",
				constraint = "char_length(trim(provider_user_id)) > 0"
		)
)
public class SocialAccount {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "member_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_social_accounts_member")
	)
	private Member member;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private OAuthProvider provider;

	@Column(name = "provider_user_id", nullable = false, length = 255)
	private String providerUserId;

	protected SocialAccount() {
	}

	private SocialAccount(Member member, OAuthProvider provider, String providerUserId) {
		this.member = member;
		this.provider = provider;
		this.providerUserId = providerUserId;
	}

	public static SocialAccount create(Member member, OAuthProvider provider, String providerUserId) {
		return new SocialAccount(member, provider, providerUserId);
	}

	public Long getId() {
		return id;
	}

	public Member getMember() {
		return member;
	}

	public OAuthProvider getProvider() {
		return provider;
	}

	public String getProviderUserId() {
		return providerUserId;
	}
}
