package junsik.reservation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import junsik.reservation.enums.MemberRole;

@Entity
@Table(
		name = "members",
		uniqueConstraints = @UniqueConstraint(name = "uk_members_email", columnNames = "email")
)
public class Member {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 255)
	private String email;

	@Column(nullable = false, length = 255)
	private String password;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private MemberRole role;

	protected Member() {
	}

	private Member(String email, String encodedPassword, MemberRole role) {
		this.email = email;
		this.password = encodedPassword;
		this.role = role;
	}

	public static Member createUser(String email, String encodedPassword) {
		return new Member(email, encodedPassword, MemberRole.USER);
	}

	public Long getId() {
		return id;
	}

	public String getEmail() {
		return email;
	}

	public String getPassword() {
		return password;
	}

	public MemberRole getRole() {
		return role;
	}
}
