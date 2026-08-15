package junsik.reservation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "accommodations")
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

	protected Accommodation() {
	}

	private Accommodation(String name, String description, String address) {
		this.name = name;
		this.description = description;
		this.address = address;
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
}
