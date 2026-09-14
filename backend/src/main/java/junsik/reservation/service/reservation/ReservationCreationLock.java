package junsik.reservation.service.reservation;

import java.util.function.Supplier;

public interface ReservationCreationLock {

	<T> T execute(Long roomId, Supplier<T> operation);
}
