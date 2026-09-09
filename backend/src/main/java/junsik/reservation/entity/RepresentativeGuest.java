package junsik.reservation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class RepresentativeGuest {

	@Column(name = "guest_name", length = 100)
	private String name;

	@Column(name = "guest_email", length = 255)
	private String email;

	@Column(name = "guest_phone", length = 30)
	private String phone;

	protected RepresentativeGuest() {
	}

	public RepresentativeGuest(String name, String email, String phone) {
		this.name = requireText(name, "대표 투숙객 이름");
		this.email = requireText(email, "대표 투숙객 이메일");
		this.phone = requireText(phone, "대표 투숙객 연락처");
	}

	public String getName() {
		return name;
	}

	public String getEmail() {
		return email;
	}

	public String getPhone() {
		return phone;
	}

	private static String requireText(String value, String fieldName) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(fieldName + "은(는) 필수입니다.");
		}
		return value.trim();
	}
}
