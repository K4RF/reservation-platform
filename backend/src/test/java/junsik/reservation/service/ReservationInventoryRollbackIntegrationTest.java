package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import junsik.reservation.dto.reservation.request.CreateReservationRequest;
import junsik.reservation.dto.reservation.request.RepresentativeGuestRequest;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.support.MySqlIntegrationTestSupport;

class ReservationInventoryRollbackIntegrationTest extends MySqlIntegrationTestSupport {

	private static final LocalDate CHECK_IN = LocalDate.of(2030, 3, 10);
	private static final LocalDate CHECK_OUT = LocalDate.of(2030, 3, 13);

	@Autowired
	private ReservationService reservationService;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private PlatformTransactionManager transactionManager;

	@MockitoBean
	private ReservationRepository reservationRepository;

	@AfterEach
	void cleanUp() {
		roomInventoryRepository.deleteAllInBatch();
		roomRepository.deleteAllInBatch();
		accommodationRepository.deleteAllInBatch();
		memberRepository.deleteAllInBatch();
	}

	@Test
	@Timeout(30)
	void rollsBackEveryInventoryChangeWhenReservationSaveFails() {
		Member member = memberRepository.saveAndFlush(member("rollback@example.com"));
		Accommodation accommodation = accommodationRepository.saveAndFlush(accommodation("Rollback Hotel"));
		Room room = roomRepository.saveAndFlush(room(accommodation));
		CHECK_IN.datesUntil(CHECK_OUT).forEach(date ->
				roomInventoryRepository.save(RoomInventory.create(room, date, 1))
		);
		roomInventoryRepository.flush();
		when(reservationRepository.save(any(Reservation.class)))
				.thenThrow(new IllegalStateException("forced reservation save failure"));

		assertThatThrownBy(() -> reservationService.create(
				member.getId(),
				new CreateReservationRequest(
						room.getId(),
						2,
						CHECK_IN,
						CHECK_OUT,
						new RepresentativeGuestRequest("Test Guest", "guest@example.com", "010-1234-5678")
				)
		)).isInstanceOf(IllegalStateException.class);

		assertThat(roomInventoryRepository
				.findAllByRoomIdAndInventoryDateGreaterThanEqualAndInventoryDateLessThanOrderByInventoryDateAsc(
						room.getId(),
						CHECK_IN,
						CHECK_OUT
				))
				.extracting(RoomInventory::getReservedQuantity)
				.containsOnly(0);
		assertThat(jdbcTemplate.queryForObject(
				"select count(*) from reservation_nights",
				Integer.class
		)).isZero();

		List<Integer> quantitiesAfterLockReacquisition = new TransactionTemplate(transactionManager)
				.execute(status -> roomInventoryRepository
						.findAllForUpdateByRoomIdAndInventoryDateIn(
								room.getId(),
								CHECK_IN.datesUntil(CHECK_OUT).toList()
						)
						.stream()
						.map(RoomInventory::getReservedQuantity)
						.toList());
		assertThat(quantitiesAfterLockReacquisition).containsOnly(0);
	}
}
