package junsik.reservation.entity;

import jakarta.persistence.Column;
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

import org.hibernate.annotations.ColumnDefault;

import junsik.reservation.enums.RoomStatus;

@Entity
@Table(name = "rooms")
public class Room {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "accommodation_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_rooms_accommodation")
	)
	private Accommodation accommodation;

	@Column(nullable = false, length = 100)
	private String name;

	@Column(nullable = false)
	private int capacity;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	@ColumnDefault("'ACTIVE'")
	private RoomStatus status;

	protected Room() {
	}

	private Room(Accommodation accommodation, String name, int capacity) {
		this.accommodation = accommodation;
		this.name = name;
		this.capacity = capacity;
		this.status = RoomStatus.ACTIVE;
	}

	public static Room create(Accommodation accommodation, String name, int capacity) {
		return new Room(accommodation, name, capacity);
	}

	public Long getId() {
		return id;
	}

	public Accommodation getAccommodation() {
		return accommodation;
	}

	public String getName() {
		return name;
	}

	public int getCapacity() {
		return capacity;
	}

	public RoomStatus getStatus() {
		return status;
	}
}
