package junsik.reservation.entity;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;

public record ReservationPeriod(LocalDate checkInDate, LocalDate checkOutDate) {

	public ReservationPeriod {
		Objects.requireNonNull(checkInDate, "checkInDate must not be null");
		Objects.requireNonNull(checkOutDate, "checkOutDate must not be null");
		if (!checkInDate.isBefore(checkOutDate)) {
			throw new IllegalArgumentException("체크인 날짜는 체크아웃 날짜보다 이전이어야 합니다.");
		}
	}

	public long stayNights() {
		return ChronoUnit.DAYS.between(checkInDate, checkOutDate);
	}

	public List<LocalDate> stayDates() {
		return checkInDate.datesUntil(checkOutDate).toList();
	}
}
