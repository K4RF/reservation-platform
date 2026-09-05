package junsik.reservation.entity;

import java.math.BigDecimal;
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

import junsik.reservation.enums.RoomDailyPriceErrorCode;
import junsik.reservation.global.exception.BusinessException;

@Entity
@Table(
		name = "room_daily_prices",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_room_daily_prices_room_date",
				columnNames = {"room_id", "stay_date"}
		),
		check = @CheckConstraint(
				name = "chk_room_daily_prices_positive",
				constraint = "nightly_price > 0"
		)
)
public class RoomDailyPrice {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "room_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_room_daily_prices_room")
	)
	private Room room;

	@Column(name = "stay_date", nullable = false)
	private LocalDate stayDate;

	@Column(name = "nightly_price", nullable = false, precision = 12, scale = 2)
	private BigDecimal nightlyPrice;

	protected RoomDailyPrice() {
	}

	private RoomDailyPrice(Room room, LocalDate stayDate, BigDecimal nightlyPrice) {
		this.room = Objects.requireNonNull(room, "room must not be null");
		this.stayDate = Objects.requireNonNull(stayDate, "stayDate must not be null");
		validateNightlyPrice(nightlyPrice);
		this.nightlyPrice = nightlyPrice;
	}

	public static RoomDailyPrice create(Room room, LocalDate stayDate, BigDecimal nightlyPrice) {
		return new RoomDailyPrice(room, stayDate, nightlyPrice);
	}

	public Long getId() {
		return id;
	}

	public Room getRoom() {
		return room;
	}

	public LocalDate getStayDate() {
		return stayDate;
	}

	public BigDecimal getNightlyPrice() {
		return nightlyPrice;
	}

	public void changeNightlyPrice(BigDecimal nightlyPrice) {
		validateNightlyPrice(nightlyPrice);
		this.nightlyPrice = nightlyPrice;
	}

	private void validateNightlyPrice(BigDecimal nightlyPrice) {
		if (nightlyPrice == null || nightlyPrice.signum() <= 0) {
			throw new BusinessException(RoomDailyPriceErrorCode.INVALID_PRICE);
		}
	}
}
