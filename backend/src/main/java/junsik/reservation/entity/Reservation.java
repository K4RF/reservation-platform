package junsik.reservation.entity;

import java.time.LocalDate;

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

import junsik.reservation.enums.ReservationStatus;

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

	public ReservationStatus getStatus() {
		return status;
	}

	public boolean isCancellable() {
		return status == ReservationStatus.CONFIRMED;
	}

	public void cancel() {
		if (!isCancellable()) {
			throw new IllegalStateException("확정 상태의 예약만 취소할 수 있습니다.");
		}
		this.status = ReservationStatus.CANCELLED;
	}
}
