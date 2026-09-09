package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.BDDMockito.given;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.AccommodationBookingPolicy;
import junsik.reservation.entity.ReservationPeriod;
import junsik.reservation.enums.BookingPolicyErrorCode;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationBookingPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;

@ExtendWith(MockitoExtension.class)
class AccommodationBookingPolicyTimeZoneTest {

	@Mock
	private AccommodationBookingPolicyRepository bookingPolicyRepository;

	@Mock
	private AccommodationRepository accommodationRepository;

	@Mock
	private ReservationDateProvider dateProvider;

	@Test
	void validatesAdvanceBookingDaysWithEachAccommodationTimeZone() {
		Accommodation tokyo = accommodation("Asia/Tokyo");
		Accommodation newYork = accommodation("America/New_York");
		AccommodationBookingPolicy tokyoPolicy = oneDayAdvancePolicy(tokyo);
		AccommodationBookingPolicy newYorkPolicy = oneDayAdvancePolicy(newYork);
		AccommodationBookingPolicyService service = new AccommodationBookingPolicyService(
				bookingPolicyRepository,
				accommodationRepository,
				dateProvider
		);
		ReservationPeriod period = new ReservationPeriod(
				LocalDate.of(2030, 7, 2),
				LocalDate.of(2030, 7, 3)
		);
		given(bookingPolicyRepository.findByAccommodationId(null))
				.willReturn(Optional.of(tokyoPolicy))
				.willReturn(Optional.of(newYorkPolicy));
		given(dateProvider.today(ZoneId.of("Asia/Tokyo"))).willReturn(LocalDate.of(2030, 7, 1));
		given(dateProvider.today(ZoneId.of("America/New_York"))).willReturn(LocalDate.of(2030, 6, 30));

		service.validateReservationPeriod(tokyo, period);
		BusinessException exception = catchThrowableOfType(
				BusinessException.class,
				() -> service.validateReservationPeriod(newYork, period)
		);

		assertThat(exception.getErrorCode()).isEqualTo(BookingPolicyErrorCode.ADVANCE_TOO_LONG);
	}

	private AccommodationBookingPolicy oneDayAdvancePolicy(Accommodation accommodation) {
		return AccommodationBookingPolicy.create(accommodation, 1, 10, 1, 1);
	}

	private Accommodation accommodation(String timeZone) {
		return Accommodation.create(
				"Time Zone Hotel",
				"Description",
				"Country",
				"City",
				"Region",
				"Address",
				Set.of(),
				LocalTime.of(15, 0),
				LocalTime.of(11, 0),
				timeZone
		);
	}
}
