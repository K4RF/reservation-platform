package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import junsik.reservation.enums.CancellationPolicyErrorCode;
import junsik.reservation.enums.ReservationErrorCode;
import junsik.reservation.global.exception.BusinessException;

class CancellationPolicySnapshotTest {

	@Test
	void resolvesFreePartialAndDeniedCancellationBoundaries() {
		CancellationPolicySnapshot snapshot = snapshot(
				7,
				1,
				CancellationFeeRule.create(1, 50),
				CancellationFeeRule.create(3, 30)
		);

		assertThat(snapshot.resolveFeeRatePercent(7)).isZero();
		assertThat(snapshot.resolveFeeRatePercent(6)).isEqualTo(30);
		assertThat(snapshot.resolveFeeRatePercent(3)).isEqualTo(30);
		assertThat(snapshot.resolveFeeRatePercent(2)).isEqualTo(50);
		assertThat(snapshot.resolveFeeRatePercent(1)).isEqualTo(50);
		assertError(
				() -> snapshot.resolveFeeRatePercent(0),
				ReservationErrorCode.CANCELLATION_NOT_ALLOWED
		);
	}

	@Test
	void rejectsInvalidPeriodAndFeeRuleConfiguration() {
		assertError(
				() -> snapshot(1, 1, CancellationFeeRule.create(1, 30)),
				CancellationPolicyErrorCode.INVALID_PERIOD_RANGE
		);
		assertError(
				() -> snapshot(7, 1),
				CancellationPolicyErrorCode.INVALID_FEE_RULES
		);
		assertError(
				() -> snapshot(
						7,
						1,
						CancellationFeeRule.create(3, 30),
						CancellationFeeRule.create(3, 50)
				),
				CancellationPolicyErrorCode.INVALID_FEE_RULES
		);
		assertError(
				() -> snapshot(7, 1, CancellationFeeRule.create(2, 30)),
				CancellationPolicyErrorCode.INVALID_FEE_RULES
		);
	}

	@Test
	void rejectsFeeRateOutsideOneToOneHundredPercent() {
		assertError(
				() -> CancellationFeeRule.create(1, 0),
				CancellationPolicyErrorCode.INVALID_FEE_RATE
		);
		assertError(
				() -> CancellationFeeRule.create(1, 101),
				CancellationPolicyErrorCode.INVALID_FEE_RATE
		);
	}

	private CancellationPolicySnapshot snapshot(
			int freeDays,
			int deadlineDays,
			CancellationFeeRule... rules
	) {
		return new CancellationPolicySnapshot(freeDays, deadlineDays, List.of(rules));
	}

	private void assertError(Runnable operation, Object errorCode) {
		assertThatThrownBy(operation::run)
				.isInstanceOfSatisfying(BusinessException.class, exception ->
						assertThat(exception.getErrorCode()).isEqualTo(errorCode));
	}
}
