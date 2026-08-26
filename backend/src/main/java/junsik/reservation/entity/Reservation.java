package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import jakarta.persistence.Column;
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
		indexes = {
				@Index(
						name = "idx_reservations_room_status_period",
						columnList = "room_id,status,check_in_date,check_out_date"
				),
				@Index(name = "idx_reservations_member", columnList = "member_id")
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

	private Reservation(Member member, Room room, LocalDate checkInDate, LocalDate checkOutDate) {
		this.member = member;
		this.room = room;
		this.checkInDate = checkInDate;
		this.checkOutDate = checkOutDate;
		this.nightlyPriceSnapshot = room.getNightlyPrice();
		this.totalAmount = calculateTotalAmount(nightlyPriceSnapshot, checkInDate, checkOutDate);
		this.status = ReservationStatus.CONFIRMED;
	}

	public static Reservation create(
			Member member,
			Room room,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		return new Reservation(member, room, checkInDate, checkOutDate);
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
		return ChronoUnit.DAYS.between(checkInDate, checkOutDate);
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

	public void changeSchedule(LocalDate checkInDate, LocalDate checkOutDate) {
		verifyScheduleChangeAllowed();
		BigDecimal recalculatedTotalAmount = calculateTotalAmount(
				nightlyPriceSnapshot,
				checkInDate,
				checkOutDate
		);
		this.checkInDate = checkInDate;
		this.checkOutDate = checkOutDate;
		this.totalAmount = recalculatedTotalAmount;
	}

	public void cancel() {
		requireConfirmed(Operation.CANCEL);
		this.status = ReservationStatus.CANCELLED;
	}

	private void requireConfirmed(Operation operation) {
		if (status != ReservationStatus.CONFIRMED) {
			throw new InvalidReservationStateTransitionException(status, operation);
		}
	}

	private BigDecimal calculateTotalAmount(
			BigDecimal nightlyPrice,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		long stayNights = ChronoUnit.DAYS.between(checkInDate, checkOutDate);
		if (stayNights <= 0) {
			throw new IllegalArgumentException("체크인 날짜는 체크아웃 날짜보다 이전이어야 합니다.");
		}
		return nightlyPrice.multiply(BigDecimal.valueOf(stayNights));
	}
}
