package junsik.reservation.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.CheckConstraint;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Embedded;
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
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import org.hibernate.annotations.ColumnDefault;

import junsik.reservation.enums.ReservationStatus;
import junsik.reservation.global.exception.InvalidReservationStateTransitionException;
import junsik.reservation.global.exception.InvalidReservationStateTransitionException.Operation;

@Entity
@Table(
		name = "reservations",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_reservations_reservation_number",
				columnNames = "reservation_number"
		),
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
				),
				@CheckConstraint(
						name = "chk_reservations_cancellation_policy_snapshot",
						constraint = "cancellation_deadline_days_before_check_in >= 0"
								+ " and free_cancellation_days_before_check_in"
								+ " > cancellation_deadline_days_before_check_in"
				),
				@CheckConstraint(
						name = "chk_reservations_cancellation_result",
						constraint = "(cancellation_fee_amount is null or cancellation_fee_amount >= 0)"
								+ " and (refund_amount is null or refund_amount >= 0)"
				),
				@CheckConstraint(
						name = "chk_reservations_reservation_number",
						constraint = "char_length(trim(reservation_number)) > 0"
				),
				@CheckConstraint(
						name = "chk_reservations_representative_guest",
						constraint = "(guest_name is null and guest_email is null and guest_phone is null)"
								+ " or (guest_name is not null and guest_email is not null and guest_phone is not null"
								+ " and char_length(trim(guest_name)) > 0"
								+ " and char_length(trim(guest_email)) > 0"
								+ " and char_length(trim(guest_phone)) > 0)"
				)
		}
)
public class Reservation {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "reservation_number", nullable = false, length = 40)
	private String reservationNumber;

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

	@Embedded
	private RepresentativeGuest representativeGuest;

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

	@OneToMany(mappedBy = "reservation", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("stayDate ASC")
	private List<ReservationNight> nights = new ArrayList<>();

	@Column(name = "free_cancellation_days_before_check_in", nullable = false)
	@ColumnDefault("7")
	private int freeCancellationDaysBeforeCheckIn;

	@Column(name = "cancellation_deadline_days_before_check_in", nullable = false)
	@ColumnDefault("1")
	private int cancellationDeadlineDaysBeforeCheckIn;

	@ElementCollection
	@CollectionTable(
			name = "reservation_cancellation_fee_snapshots",
			joinColumns = @JoinColumn(name = "reservation_id", nullable = false),
			foreignKey = @ForeignKey(name = "fk_cancellation_fee_snapshots_reservation"),
			uniqueConstraints = @UniqueConstraint(
					name = "uk_cancellation_fee_snapshots_reservation_order",
					columnNames = {"reservation_id", "rule_order"}
			)
	)
	@OrderColumn(name = "rule_order", nullable = false)
	private List<CancellationFeeRule> cancellationFeeRules = new ArrayList<>();

	@Column(name = "cancelled_at")
	private Instant cancelledAt;

	@Column(name = "cancellation_fee_amount", precision = 19, scale = 2)
	private BigDecimal cancellationFeeAmount;

	@Column(name = "refund_amount", precision = 19, scale = 2)
	private BigDecimal refundAmount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private ReservationStatus status;

	protected Reservation() {
	}

	private Reservation(
			String reservationNumber,
			Member member,
			Room room,
			int guestCount,
			RepresentativeGuest representativeGuest,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			ReservationPriceSnapshot priceSnapshot,
			CancellationPolicySnapshot cancellationPolicySnapshot
	) {
		if (reservationNumber == null || reservationNumber.isBlank()) {
			throw new IllegalArgumentException("예약번호는 필수입니다.");
		}
		if (representativeGuest == null) {
			throw new IllegalArgumentException("대표 투숙객 정보는 필수입니다.");
		}
		if (!room.canAccommodate(guestCount)) {
			throw new IllegalArgumentException("예약 인원은 1명 이상이며 객실 최대 수용 인원 이하여야 합니다.");
		}
		ReservationPeriod period = new ReservationPeriod(checkInDate, checkOutDate);
		validatePriceSnapshot(period, priceSnapshot);
		this.reservationNumber = reservationNumber;
		this.member = member;
		this.room = room;
		this.guestCount = guestCount;
		this.representativeGuest = representativeGuest;
		this.checkInDate = checkInDate;
		this.checkOutDate = checkOutDate;
		applyPriceSnapshot(priceSnapshot);
		applyCancellationPolicySnapshot(cancellationPolicySnapshot);
		this.status = ReservationStatus.CONFIRMED;
	}

	public static Reservation create(
			String reservationNumber,
			Member member,
			Room room,
			int guestCount,
			RepresentativeGuest representativeGuest,
			LocalDate checkInDate,
			LocalDate checkOutDate
	) {
		ReservationPeriod period = new ReservationPeriod(checkInDate, checkOutDate);
		ReservationPriceSnapshot priceSnapshot = ReservationPriceSnapshot.calculate(
				period,
				room.getNightlyPrice(),
				Map.of()
		);
		return create(
				reservationNumber,
				member,
				room,
				guestCount,
				representativeGuest,
				checkInDate,
				checkOutDate,
				priceSnapshot,
				CancellationPolicySnapshot.defaultPolicy()
		);
	}

	public static Reservation create(
			String reservationNumber,
			Member member,
			Room room,
			int guestCount,
			RepresentativeGuest representativeGuest,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			ReservationPriceSnapshot priceSnapshot
	) {
		return create(
				reservationNumber,
				member,
				room,
				guestCount,
				representativeGuest,
				checkInDate,
				checkOutDate,
				priceSnapshot,
				CancellationPolicySnapshot.defaultPolicy()
		);
	}

	public static Reservation create(
			String reservationNumber,
			Member member,
			Room room,
			int guestCount,
			RepresentativeGuest representativeGuest,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			ReservationPriceSnapshot priceSnapshot,
			CancellationPolicySnapshot cancellationPolicySnapshot
	) {
		return new Reservation(
				reservationNumber,
				member,
				room,
				guestCount,
				representativeGuest,
				checkInDate,
				checkOutDate,
				priceSnapshot,
				cancellationPolicySnapshot
		);
	}

	public Long getId() {
		return id;
	}

	public String getReservationNumber() {
		return reservationNumber;
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

	public RepresentativeGuest getRepresentativeGuest() {
		return representativeGuest;
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

	public List<ReservationNight> getNights() {
		return List.copyOf(nights);
	}

	public Instant getCancelledAt() {
		return cancelledAt;
	}

	public BigDecimal getCancellationFeeAmount() {
		return cancellationFeeAmount;
	}

	public BigDecimal getRefundAmount() {
		return refundAmount;
	}

	public ReservationStatus getStatus() {
		return status;
	}

	public CancellationPolicySnapshot getCancellationPolicySnapshot() {
		if (cancellationFeeRules.isEmpty()) {
			return CancellationPolicySnapshot.defaultPolicy();
		}
		return new CancellationPolicySnapshot(
				freeCancellationDaysBeforeCheckIn,
				cancellationDeadlineDaysBeforeCheckIn,
				cancellationFeeRules
		);
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
		ReservationPeriod period = new ReservationPeriod(checkInDate, checkOutDate);
		validatePriceSnapshot(period, priceSnapshot);
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

	public void cancel(ReservationCancellationQuote quote) {
		verifyCancellationAllowed();
		if (quote == null) {
			throw new IllegalArgumentException("취소 결과 Snapshot은 필수입니다.");
		}
		if (quote.cancellationFeeAmount().add(quote.estimatedRefundAmount()).compareTo(totalAmount) != 0) {
			throw new IllegalArgumentException("취소 수수료와 환불액의 합은 예약 총액과 일치해야 합니다.");
		}
		this.cancelledAt = quote.cancelledAt();
		this.cancellationFeeAmount = quote.cancellationFeeAmount();
		this.refundAmount = quote.estimatedRefundAmount();
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
		Map<LocalDate, ReservationNight> existingNights = nights.stream()
				.collect(Collectors.toMap(ReservationNight::getStayDate, Function.identity()));
		Set<LocalDate> updatedDates = priceSnapshot.nights().stream()
				.map(ReservationNightPrice::stayDate)
				.collect(Collectors.toSet());
		nights.removeIf(night -> !updatedDates.contains(night.getStayDate()));
		for (ReservationNightPrice nightPrice : priceSnapshot.nights()) {
			ReservationNight existing = existingNights.get(nightPrice.stayDate());
			if (existing == null) {
				nights.add(ReservationNight.create(this, nightPrice));
			} else {
				existing.changePriceSnapshot(nightPrice.priceSnapshot());
			}
		}
		nights.sort(Comparator.comparing(ReservationNight::getStayDate));
	}

	private void requirePriceSnapshot(ReservationPriceSnapshot priceSnapshot) {
		if (priceSnapshot == null) {
			throw new IllegalArgumentException("가격 Snapshot은 필수입니다.");
		}
	}

	private void validatePriceSnapshot(
			ReservationPeriod period,
			ReservationPriceSnapshot priceSnapshot
	) {
		requirePriceSnapshot(priceSnapshot);
		List<LocalDate> snapshotDates = priceSnapshot.nights().stream()
				.map(ReservationNightPrice::stayDate)
				.toList();
		if (!snapshotDates.equals(period.stayDates())) {
			throw new IllegalArgumentException("숙박일별 가격 Snapshot 날짜는 예약 기간과 일치해야 합니다.");
		}
	}

	private void applyCancellationPolicySnapshot(CancellationPolicySnapshot policySnapshot) {
		if (policySnapshot == null) {
			throw new IllegalArgumentException("취소 정책 Snapshot은 필수입니다.");
		}
		this.freeCancellationDaysBeforeCheckIn = policySnapshot.freeCancellationDaysBeforeCheckIn();
		this.cancellationDeadlineDaysBeforeCheckIn = policySnapshot.cancellationDeadlineDaysBeforeCheckIn();
		policySnapshot.feeRules().stream()
				.map(CancellationFeeRule::copy)
				.forEach(this.cancellationFeeRules::add);
	}
}
