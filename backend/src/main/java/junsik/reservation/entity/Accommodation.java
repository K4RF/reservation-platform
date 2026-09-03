package junsik.reservation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.ColumnDefault;

import junsik.reservation.enums.AccommodationStatus;

@Entity
@Table(
		name = "accommodations",
		check = @CheckConstraint(
				name = "chk_accommodations_required_text",
				constraint = "char_length(trim(name)) > 0"
						+ " and char_length(trim(description)) > 0"
						+ " and char_length(trim(address)) > 0"
		)
)
public class Accommodation {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false, length = 1000)
	private String description;

	@Column(nullable = false, length = 255)
	private String address;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	@ColumnDefault("'ACTIVE'")
	private AccommodationStatus status;

	protected Accommodation() {
	}

	private Accommodation(String name, String description, String address) {
		this.name = name;
		this.description = description;
		this.address = address;
		this.status = AccommodationStatus.ACTIVE;
	}

	public static Accommodation create(String name, String description, String address) {
		return new Accommodation(name, description, address);
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
		return address;
	}

	public AccommodationStatus getStatus() {
		return status;
	}

	public boolean isActive() {
		return status == AccommodationStatus.ACTIVE;
	}

	public void update(String name, String description, String address) {
		this.name = name;
		this.description = description;
		this.address = address;
	}

	public void changeStatus(AccommodationStatus status) {
		this.status = status;
	}
}
