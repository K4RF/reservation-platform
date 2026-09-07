package junsik.reservation.entity;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import junsik.reservation.enums.BookingPolicyErrorCode;
import junsik.reservation.global.exception.BusinessException;

@Entity
@Table(
		name = "accommodation_booking_policies",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_booking_policies_accommodation",
				columnNames = "accommodation_id"
		),
		check = @CheckConstraint(
				name = "chk_booking_policies_ranges",
				constraint = "min_stay_nights >= 1"
						+ " and max_stay_nights >= min_stay_nights"
						+ " and min_advance_booking_days >= 0"
						+ " and max_advance_booking_days >= min_advance_booking_days"
		)
)
public class AccommodationBookingPolicy {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "accommodation_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_booking_policies_accommodation")
	)
	private Accommodation accommodation;

	@Column(name = "min_stay_nights", nullable = false)
	private int minStayNights;

	@Column(name = "max_stay_nights", nullable = false)
	private int maxStayNights;

	@Column(name = "min_advance_booking_days", nullable = false)
	private int minAdvanceBookingDays;

	@Column(name = "max_advance_booking_days", nullable = false)
	private int maxAdvanceBookingDays;

	protected AccommodationBookingPolicy() {
	}

	private AccommodationBookingPolicy(
			Accommodation accommodation,
			int minStayNights,
			int maxStayNights,
			int minAdvanceBookingDays,
			int maxAdvanceBookingDays
	) {
		this.accommodation = Objects.requireNonNull(accommodation, "accommodation must not be null");
		update(minStayNights, maxStayNights, minAdvanceBookingDays, maxAdvanceBookingDays);
	}

	public static AccommodationBookingPolicy create(
			Accommodation accommodation,
			int minStayNights,
			int maxStayNights,
			int minAdvanceBookingDays,
			int maxAdvanceBookingDays
	) {
		return new AccommodationBookingPolicy(
				accommodation,
				minStayNights,
				maxStayNights,
				minAdvanceBookingDays,
				maxAdvanceBookingDays
		);
	}

	public void update(
			int minStayNights,
			int maxStayNights,
			int minAdvanceBookingDays,
			int maxAdvanceBookingDays
	) {
		if (minStayNights < 1 || maxStayNights < minStayNights) {
			throw new BusinessException(BookingPolicyErrorCode.INVALID_STAY_RANGE);
		}
		if (minAdvanceBookingDays < 0 || maxAdvanceBookingDays < minAdvanceBookingDays) {
			throw new BusinessException(BookingPolicyErrorCode.INVALID_ADVANCE_RANGE);
		}
		this.minStayNights = minStayNights;
		this.maxStayNights = maxStayNights;
		this.minAdvanceBookingDays = minAdvanceBookingDays;
		this.maxAdvanceBookingDays = maxAdvanceBookingDays;
	}

	public void validateReservationPeriod(LocalDate today, ReservationPeriod period) {
		Objects.requireNonNull(today, "today must not be null");
		Objects.requireNonNull(period, "period must not be null");
		long stayNights = period.stayNights();
		if (stayNights < minStayNights) {
			throw new BusinessException(BookingPolicyErrorCode.STAY_TOO_SHORT);
		}
		if (stayNights > maxStayNights) {
			throw new BusinessException(BookingPolicyErrorCode.STAY_TOO_LONG);
		}

		long advanceBookingDays = ChronoUnit.DAYS.between(today, period.checkInDate());
		if (advanceBookingDays < minAdvanceBookingDays) {
			throw new BusinessException(BookingPolicyErrorCode.ADVANCE_TOO_SHORT);
		}
		if (advanceBookingDays > maxAdvanceBookingDays) {
			throw new BusinessException(BookingPolicyErrorCode.ADVANCE_TOO_LONG);
		}
	}

	public Long getId() {
		return id;
	}

	public Accommodation getAccommodation() {
		return accommodation;
	}

	public int getMinStayNights() {
		return minStayNights;
	}

	public int getMaxStayNights() {
		return maxStayNights;
	}

	public int getMinAdvanceBookingDays() {
		return minAdvanceBookingDays;
	}

	public int getMaxAdvanceBookingDays() {
		return maxAdvanceBookingDays;
	}
}
