package junsik.reservation.entity;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import jakarta.persistence.CheckConstraint;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
		name = "accommodation_cancellation_policies",
		uniqueConstraints = @UniqueConstraint(
				name = "uk_cancellation_policies_accommodation",
				columnNames = "accommodation_id"
		),
		check = @CheckConstraint(
				name = "chk_cancellation_policies_period",
				constraint = "cancellation_deadline_days_before_check_in >= 0"
						+ " and free_cancellation_days_before_check_in"
						+ " > cancellation_deadline_days_before_check_in"
		)
)
public class AccommodationCancellationPolicy {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(
			name = "accommodation_id",
			nullable = false,
			foreignKey = @ForeignKey(name = "fk_cancellation_policies_accommodation")
	)
	private Accommodation accommodation;

	@Column(name = "free_cancellation_days_before_check_in", nullable = false)
	private int freeCancellationDaysBeforeCheckIn;

	@Column(name = "cancellation_deadline_days_before_check_in", nullable = false)
	private int cancellationDeadlineDaysBeforeCheckIn;

	@ElementCollection
	@CollectionTable(
			name = "cancellation_policy_fee_rules",
			joinColumns = @JoinColumn(name = "cancellation_policy_id", nullable = false),
			foreignKey = @ForeignKey(name = "fk_cancellation_fee_rules_policy"),
			uniqueConstraints = @UniqueConstraint(
					name = "uk_cancellation_fee_rules_policy_order",
					columnNames = {"cancellation_policy_id", "rule_order"}
			)
	)
	@OrderColumn(name = "rule_order", nullable = false)
	private List<CancellationFeeRule> feeRules = new ArrayList<>();

	protected AccommodationCancellationPolicy() {
	}

	private AccommodationCancellationPolicy(
			Accommodation accommodation,
			CancellationPolicySnapshot policy
	) {
		this.accommodation = Objects.requireNonNull(accommodation, "accommodation must not be null");
		apply(policy);
	}

	public static AccommodationCancellationPolicy create(
			Accommodation accommodation,
			CancellationPolicySnapshot policy
	) {
		return new AccommodationCancellationPolicy(accommodation, policy);
	}

	public void update(CancellationPolicySnapshot policy) {
		apply(policy);
	}

	public CancellationPolicySnapshot snapshot() {
		return new CancellationPolicySnapshot(
				freeCancellationDaysBeforeCheckIn,
				cancellationDeadlineDaysBeforeCheckIn,
				feeRules
		);
	}

	private void apply(CancellationPolicySnapshot policy) {
		Objects.requireNonNull(policy, "policy must not be null");
		this.freeCancellationDaysBeforeCheckIn = policy.freeCancellationDaysBeforeCheckIn();
		this.cancellationDeadlineDaysBeforeCheckIn = policy.cancellationDeadlineDaysBeforeCheckIn();
		this.feeRules.clear();
		policy.feeRules().stream().map(CancellationFeeRule::copy).forEach(this.feeRules::add);
	}

	public Long getId() {
		return id;
	}

	public Accommodation getAccommodation() {
		return accommodation;
	}

	public int getFreeCancellationDaysBeforeCheckIn() {
		return freeCancellationDaysBeforeCheckIn;
	}

	public int getCancellationDeadlineDaysBeforeCheckIn() {
		return cancellationDeadlineDaysBeforeCheckIn;
	}

	public List<CancellationFeeRule> getFeeRules() {
		return List.copyOf(feeRules);
	}
}
