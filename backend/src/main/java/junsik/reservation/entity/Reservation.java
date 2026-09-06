package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

import jakarta.persistence.Column;
import jakarta.persistence.CheckConstraint;
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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.ColumnDefault;

import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.global.exception.InvalidReservationStateTransitionException;
import junsik.reservation.global.exception.InvalidReservationStateTransitionException.Operation;

@Entity
@Table(
		name = "reservations",
		indexes = @Index(name = "idx_reservations_member", columnList = "member_id"),
		check = {
				@CheckConstraint(
						name = "chk_reservations_business_values",
						constraint = "check_in_date < check_out_date"
								+ " and nightly_price_snapshot >= 0"
								+ " and total_amount >= 0"
				),
				@CheckConstraint(
						name = "chk_reservations_guest_count",
						constraint = "guest_count >= 1"
				)
		}
)
public class Reservation {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "member_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_reservations_member")
	)
	private Member member;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "room_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_reservations_room")
	)
	private Room room;

	@Column(name = "guest_count", nullable = false)
	@ColumnDefault("1")
	private int guestCount;

	@Column(name = "check_in_date", nullable = false)
	private LocalDate checkInDate;

	@Column(name = "check_out_date", nullable = false)
	private LocalDate checkOutDate;

	@Column(name = "nightly_price_snapshot", nullable = false, precision = 12, scale = 2)
	@ColumnDefault("0.00")
	private BigDecimal nightlyPriceSnapshot;

	@Column(name = "total_amount", nullable = false, precision = 19, scale = 2)
	@ColumnDefault("0.00")
	private BigDecimal totalAmount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ReservationStatus status;

	protected Reservation() {
	}

	private Reservation(
			Member member,
			Room room,
			int guestCount,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			ReservationPriceSnapshot priceSnapshot
	) {
		if (!room.canAccommodate(guestCount)) {
			throw new IllegalArgumentException("예약 인원은 1명 이상이며 객실 최대 수용 인원 이하여야 합니다.");
		}
		new ReservationPeriod(checkInDate, checkOutDate);
		requirePriceSnapshot(priceSnapshot);
		this.member = member;
		this.room = room;
		this.guestCount = guestCount;
		this.checkInDate = checkInDate;
		this.checkOutDate = checkOutDate;
		applyPriceSnapshot(priceSnapshot);
		this.status = ReservationStatus.CONFIRMED;
	}

	public static Reservation create(
			Member member,
			Room room,
			int guestCount,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		ReservationPeriod period = new ReservationPeriod(checkInDate, checkOutDate);
		ReservationPriceSnapshot priceSnapshot = ReservationPriceSnapshot.calculate(
				period,
				room.getNightlyPrice(),
				Map.of()
		);
		return create(member, room, guestCount, checkInDate, checkOutDate, priceSnapshot);
	}

	public static Reservation create(
			Member member,
			Room room,
			int guestCount,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			ReservationPriceSnapshot priceSnapshot
	) {
		return new Reservation(member, room, guestCount, checkInDate, checkOutDate, priceSnapshot);
	}

	public Long getId() {
		return id;
	}

	public Member getMember() {
		return member;
	}

	public Room getRoom() {
		return room;
	}

	public int getGuestCount() {
		return guestCount;
	}

	public LocalDate getCheckInDate() {
		return checkInDate;
	}

	public LocalDate getCheckOutDate() {
		return checkOutDate;
	}

	public BigDecimal getNightlyPriceSnapshot() {
		return nightlyPriceSnapshot;
	}

	public long getStayNights() {
		return getPeriod().stayNights();
	}

	public ReservationPeriod getPeriod() {
		return new ReservationPeriod(checkInDate, checkOutDate);
	}

	public BigDecimal getTotalAmount() {
		return totalAmount;
	}

	public ReservationStatus getStatus() {
		return status;
	}

	public void verifyScheduleChangeAllowed() {
		requireConfirmed(Operation.CHANGE_SCHEDULE);
	}

	public void verifyCancellationAllowed() {
		requireConfirmed(Operation.CANCEL);
	}

	public void changeSchedule(LocalDate checkInDate, LocalDate checkOutDate) {
		verifyScheduleChangeAllowed();
		ReservationPeriod period = new ReservationPeriod(checkInDate, checkOutDate);
		ReservationPriceSnapshot priceSnapshot = ReservationPriceSnapshot.calculate(
				period,
				nightlyPriceSnapshot,
				Map.of()
		);
		applySchedule(checkInDate, checkOutDate, priceSnapshot);
	}

	public void changeSchedule(
			LocalDate checkInDate,
			LocalDate checkOutDate,
			ReservationPriceSnapshot priceSnapshot
	) {
		verifyScheduleChangeAllowed();
		new ReservationPeriod(checkInDate, checkOutDate);
		requirePriceSnapshot(priceSnapshot);
		applySchedule(checkInDate, checkOutDate, priceSnapshot);
	}

	private void applySchedule(
			LocalDate checkInDate,
			LocalDate checkOutDate,
			ReservationPriceSnapshot priceSnapshot
	) {
		this.checkInDate = checkInDate;
		this.checkOutDate = checkOutDate;
		applyPriceSnapshot(priceSnapshot);
	}

	public void cancel() {
		verifyCancellationAllowed();
		this.status = ReservationStatus.CANCELLED;
	}

	private void requireConfirmed(Operation operation) {
		if (status != ReservationStatus.CONFIRMED) {
			throw new InvalidReservationStateTransitionException(status, operation);
		}
	}

	private void applyPriceSnapshot(ReservationPriceSnapshot priceSnapshot) {
		requirePriceSnapshot(priceSnapshot);
		this.nightlyPriceSnapshot = priceSnapshot.firstNightPrice();
		this.totalAmount = priceSnapshot.totalAmount();
	}

	private void requirePriceSnapshot(ReservationPriceSnapshot priceSnapshot) {
		if (priceSnapshot == null) {
			throw new IllegalArgumentException("가격 Snapshot은 필수입니다.");
		}
	}
}
