package junsik.reservation.entity;

import java.time.LocalDate;
import java.util.Objects;

import jakarta.persistence.CheckConstraint;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.ColumnDefault;

import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;

@Entity
@Table(
		name = "room_inventories",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_room_inventories_room_date",
				columnNames = {"room_id", "inventory_date"}
		),
		check = @CheckConstraint(
				name = "chk_room_inventories_quantities",
				constraint = "total_quantity >= 0"
						+ " and reserved_quantity >= 0"
						+ " and reserved_quantity <= total_quantity"
		)
)
public class RoomInventory {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "room_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_room_inventories_room")
	)
	private Room room;

	@Column(name = "inventory_date", nullable = false)
	private LocalDate inventoryDate;

	@Column(name = "total_quantity", nullable = false)
	@ColumnDefault("0")
	private int totalQuantity;

	@Column(name = "reserved_quantity", nullable = false)
	@ColumnDefault("0")
	private int reservedQuantity;

	protected RoomInventory() {
	}

	private RoomInventory(Room room, LocalDate inventoryDate, int totalQuantity) {
		this.room = Objects.requireNonNull(room, "room must not be null");
		this.inventoryDate = Objects.requireNonNull(inventoryDate, "inventoryDate must not be null");
		validateTotalQuantity(totalQuantity);
		this.totalQuantity = totalQuantity;
		this.reservedQuantity = 0;
	}

	public static RoomInventory create(Room room, LocalDate inventoryDate, int totalQuantity) {
		return new RoomInventory(room, inventoryDate, totalQuantity);
	}

	public Long getId() {
		return id;
	}

	public Room getRoom() {
		return room;
	}

	public LocalDate getInventoryDate() {
		return inventoryDate;
	}

	public int getTotalQuantity() {
		return totalQuantity;
	}

	public int getReservedQuantity() {
		return reservedQuantity;
	}

	public int getAvailableQuantity() {
		return totalQuantity - reservedQuantity;
	}

	public void changeTotalQuantity(int totalQuantity) {
		validateTotalQuantity(totalQuantity);
		if (totalQuantity < reservedQuantity) {
			throw new BusinessException(RoomInventoryErrorCode.TOTAL_BELOW_RESERVED);
		}
		this.totalQuantity = totalQuantity;
	}

	public void reserve(int quantity) {
		validateChangeQuantity(quantity);
		if (quantity > getAvailableQuantity()) {
			throw new BusinessException(RoomInventoryErrorCode.INSUFFICIENT_QUANTITY);
		}
		reservedQuantity += quantity;
	}

	public void release(int quantity) {
		validateChangeQuantity(quantity);
		if (quantity > reservedQuantity) {
			throw new BusinessException(RoomInventoryErrorCode.RELEASE_EXCEEDS_RESERVED);
		}
		reservedQuantity -= quantity;
	}

	private void validateTotalQuantity(int totalQuantity) {
		if (totalQuantity < 0) {
			throw new BusinessException(RoomInventoryErrorCode.INVALID_TOTAL_QUANTITY);
		}
	}

	private void validateChangeQuantity(int quantity) {
		if (quantity < 1) {
			throw new BusinessException(RoomInventoryErrorCode.INVALID_QUANTITY);
		}
	}
}
