package junsik.reservation.service.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.request.RepresentativeGuestRequest;
import junsik.reservation.dto.reservation.response.ReservationResponse;
import junsik.reservation.entity.room.RoomInventory;
import junsik.reservation.enums.RoomInventoryErrorCode;
import junsik.reservation.global.exception.BusinessException;

@ExtendWith(MockitoExtension.class)
class ReservationRetryServiceTest {

	private static final Long MEMBER_ID = 1L;
	private static final CreateReservationRequest REQUEST = new CreateReservationRequest(
			10L,
			1,
			LocalDate.of(2036, 2, 1),
			LocalDate.of(2036, 2, 2),
			new RepresentativeGuestRequest(
					"Retry Guest",
					"retry-guest@example.com",
					"010-1234-5678"
			)
	);

	@Mock
	private ReservationService reservationService;

	private ReservationRetryService reservationRetryService;

	@BeforeEach
	void setUp() {
		reservationRetryService = new ReservationRetryService(reservationService);
	}

	@Test
	void retriesOptimisticConflictAndReturnsSuccessfulResult() {
		ObjectOptimisticLockingFailureException conflict = optimisticConflict();
		ReservationResponse expected = mock(ReservationResponse.class);
		when(reservationService.create(MEMBER_ID, REQUEST))
				.thenThrow(conflict)
				.thenReturn(expected);

		ReservationResponse actual = reservationRetryService.create(MEMBER_ID, REQUEST);

		assertThat(actual).isSameAs(expected);
		verify(reservationService, times(2)).create(MEMBER_ID, REQUEST);
	}

	@Test
	void stopsAfterThreeAttemptsAndPropagatesTheLastConflict() {
		ObjectOptimisticLockingFailureException conflict = optimisticConflict();
		when(reservationService.create(MEMBER_ID, REQUEST)).thenThrow(conflict);

		assertThatThrownBy(() -> reservationRetryService.create(MEMBER_ID, REQUEST))
				.isSameAs(conflict);
		verify(reservationService, times(ReservationRetryService.MAX_ATTEMPTS))
				.create(MEMBER_ID, REQUEST);
	}

	@Test
	void doesNotRetryNonOptimisticFailure() {
		BusinessException insufficient = new BusinessException(RoomInventoryErrorCode.INSUFFICIENT_QUANTITY);
		when(reservationService.create(MEMBER_ID, REQUEST)).thenThrow(insufficient);

		assertThatThrownBy(() -> reservationRetryService.create(MEMBER_ID, REQUEST))
				.isSameAs(insufficient);
		verify(reservationService).create(MEMBER_ID, REQUEST);
	}

	private ObjectOptimisticLockingFailureException optimisticConflict() {
		return new ObjectOptimisticLockingFailureException(RoomInventory.class, 1L);
	}
}
