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

@Entity
@Table(
		name = "reservation_nights",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_reservation_nights_reservation_date",
				columnNames = {"reservation_id", "stay_date"}
		),
		check = @CheckConstraint(
				name = "chk_reservation_nights_price",
				constraint = "price_snapshot >= 0"
		)
)
public class ReservationNight {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "reservation_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_reservation_nights_reservation")
	)
	private Reservation reservation;

	@Column(name = "stay_date", nullable = false)
	private LocalDate stayDate;

	@Column(name = "price_snapshot", nullable = false, precision = 12, scale = 2)
	private BigDecimal priceSnapshot;

	protected ReservationNight() {
	}

	private ReservationNight(
			Reservation reservation,
			LocalDate stayDate,
			BigDecimal priceSnapshot
	) {
		this.reservation = Objects.requireNonNull(reservation, "reservation must not be null");
		ReservationNightPrice nightPrice = new ReservationNightPrice(stayDate, priceSnapshot);
		this.stayDate = nightPrice.stayDate();
		this.priceSnapshot = nightPrice.priceSnapshot();
	}

	static ReservationNight create(
			Reservation reservation,
			ReservationNightPrice nightPrice
	) {
		Objects.requireNonNull(nightPrice, "nightPrice must not be null");
		return new ReservationNight(reservation, nightPrice.stayDate(), nightPrice.priceSnapshot());
	}

	public Long getId() {
		return id;
	}

	public Reservation getReservation() {
		return reservation;
	}

	public LocalDate getStayDate() {
		return stayDate;
	}

	public BigDecimal getPriceSnapshot() {
		return priceSnapshot;
	}

	void changePriceSnapshot(BigDecimal priceSnapshot) {
		this.priceSnapshot = new ReservationNightPrice(stayDate, priceSnapshot).priceSnapshot();
	}
}
