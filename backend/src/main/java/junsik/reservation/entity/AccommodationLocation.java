package junsik.reservation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

@Embeddable
public class AccommodationLocation {

	@Column(length = 100)
	private String country;

	@Column(length = 100)
	private String city;

	@Column(length = 100)
	private String region;

	@Column(name = "address", nullable = false, length = 255)
	private String detailAddress;

	protected AccommodationLocation() {
	}

	private AccommodationLocation(
			String country,
			String city,
			String region,
			String detailAddress
	) {
		this.country = normalize(country);
		this.city = normalize(city);
		this.region = normalize(region);
		this.detailAddress = requireText(detailAddress, "상세 주소");
	}

	public static AccommodationLocation structured(
			String country,
			String city,
			String region,
			String detailAddress
	) {
		return new AccommodationLocation(
				requireText(country, "국가"),
				requireText(city, "도시"),
				requireText(region, "지역"),
				detailAddress
		);
	}

	public static AccommodationLocation legacy(String detailAddress) {
		return new AccommodationLocation(null, null, null, detailAddress);
	}

	public String getCountry() {
		return country;
	}

	public String getCity() {
		return city;
	}

	public String getRegion() {
		return region;
	}

	public String getDetailAddress() {
		return detailAddress;
	}

	private static String normalize(String value) {
		return value == null ? null : value.trim();
	}

	private static String requireText(String value, String fieldName) {
		String normalized = normalize(value);
		if (normalized == null || normalized.isEmpty()) {
			throw new IllegalArgumentException(fieldName + "는 필수입니다.");
		}
		return normalized;
	}
}
