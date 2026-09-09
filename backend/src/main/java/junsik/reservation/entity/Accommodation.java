package junsik.reservation.entity;

import java.time.LocalTime;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.CheckConstraint;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.ColumnDefault;

import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationStatus;

@Entity
@Table(
		name = "accommodations",
		indexes = {
				@Index(name = "idx_accommodations_city_region", columnList = "city, region"),
				@Index(name = "idx_accommodations_region", columnList = "region")
		},
		check = {
				@CheckConstraint(
						name = "chk_accommodations_required_text",
						constraint = "char_length(trim(name)) > 0"
								+ " and char_length(trim(description)) > 0"
								+ " and char_length(trim(address)) > 0"
				),
				@CheckConstraint(
						name = "chk_accommodations_operating_times",
						constraint = "(check_in_time is null and check_out_time is null)"
								+ " or (check_in_time is not null and check_out_time is not null"
								+ " and check_in_time <> check_out_time)"
				)
		}
)
public class Accommodation {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false, length = 1000)
	private String description;

	@Embedded
	private AccommodationLocation location;

	@ElementCollection(fetch = FetchType.LAZY)
	@CollectionTable(
			name = "accommodation_amenities",
			joinColumns = @JoinColumn(name = "accommodation_id", nullable = false),
			foreignKey = @ForeignKey(name = "fk_accommodation_amenities_accommodation"),
			uniqueConstraints = @UniqueConstraint(
					name = "uk_accommodation_amenities_accommodation_amenity",
					columnNames = {"accommodation_id", "amenity"}
			)
	)
	@Enumerated(EnumType.STRING)
	@Column(name = "amenity", nullable = false, length = 50)
	private Set<AccommodationAmenity> amenities = new LinkedHashSet<>();

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	@ColumnDefault("'ACTIVE'")
	private AccommodationStatus status;

	@Column(name = "check_in_time")
	private LocalTime checkInTime;

	@Column(name = "check_out_time")
	private LocalTime checkOutTime;

	protected Accommodation() {
	}

	private Accommodation(
			String name,
			String description,
			AccommodationLocation location,
			Set<AccommodationAmenity> amenities,
			LocalTime checkInTime,
			LocalTime checkOutTime
	) {
		validateOperatingTimes(checkInTime, checkOutTime);
		this.name = name;
		this.description = description;
		this.location = location;
		this.amenities.addAll(copyAmenities(amenities));
		this.checkInTime = checkInTime;
		this.checkOutTime = checkOutTime;
		this.status = AccommodationStatus.ACTIVE;
	}

	public static Accommodation create(String name, String description, String address) {
		return new Accommodation(
				name,
				description,
				AccommodationLocation.legacy(address),
				Set.of(),
				null,
				null
		);
	}

	public static Accommodation create(
			String name,
			String description,
			String country,
			String city,
			String region,
			String detailAddress,
			Set<AccommodationAmenity> amenities
	) {
		return create(name, description, country, city, region, detailAddress, amenities, null, null);
	}

	public static Accommodation create(
			String name,
			String description,
			String country,
			String city,
			String region,
			String detailAddress,
			Set<AccommodationAmenity> amenities,
			LocalTime checkInTime,
			LocalTime checkOutTime
	) {
		return new Accommodation(
				name,
				description,
				AccommodationLocation.structured(country, city, region, detailAddress),
				amenities,
				checkInTime,
				checkOutTime
		);
	}

	public Long getId() {
		return id;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public String getAddress() {
		return location.getDetailAddress();
	}

	public String getCountry() {
		return location.getCountry();
	}

	public String getCity() {
		return location.getCity();
	}

	public String getRegion() {
		return location.getRegion();
	}

	public Set<AccommodationAmenity> getAmenities() {
		return Set.copyOf(amenities);
	}

	public AccommodationStatus getStatus() {
		return status;
	}

	public LocalTime getCheckInTime() {
		return checkInTime;
	}

	public LocalTime getCheckOutTime() {
		return checkOutTime;
	}

	public boolean isActive() {
		return status == AccommodationStatus.ACTIVE;
	}

	public void update(String name, String description, String address) {
		this.name = name;
		this.description = description;
		this.location = AccommodationLocation.legacy(address);
	}

	public void update(
			String name,
			String description,
			String country,
			String city,
			String region,
			String detailAddress,
			Set<AccommodationAmenity> amenities,
			LocalTime checkInTime,
			LocalTime checkOutTime
	) {
		validateOperatingTimes(checkInTime, checkOutTime);
		this.name = name;
		this.description = description;
		this.location = AccommodationLocation.structured(country, city, region, detailAddress);
		this.amenities.clear();
		this.amenities.addAll(copyAmenities(amenities));
		this.checkInTime = checkInTime;
		this.checkOutTime = checkOutTime;
	}

	public void changeStatus(AccommodationStatus status) {
		this.status = status;
	}

	private static Set<AccommodationAmenity> copyAmenities(Set<AccommodationAmenity> amenities) {
		return amenities == null ? Set.of() : Set.copyOf(amenities);
	}

	private static void validateOperatingTimes(LocalTime checkInTime, LocalTime checkOutTime) {
		if (checkInTime == null || checkOutTime == null) {
			if (checkInTime != null || checkOutTime != null) {
				throw new IllegalArgumentException("체크인 시간과 체크아웃 시간은 함께 설정해야 합니다.");
			}
			return;
		}
		if (checkInTime.equals(checkOutTime)) {
			throw new IllegalArgumentException("체크인 시간과 체크아웃 시간은 달라야 합니다.");
		}
	}
}
