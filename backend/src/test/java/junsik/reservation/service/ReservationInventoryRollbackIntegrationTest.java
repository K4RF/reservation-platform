package junsik.reservation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;

import java.time.LocalDate;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import junsik.reservation.dto.CreateReservationRequest;
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

@SpringBootTest
class ReservationInventoryRollbackIntegrationTest {

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
				new CreateReservationRequest(room.getId(), 2, CHECK_IN, CHECK_OUT)
		)).isInstanceOf(IllegalStateException.class);

		assertThat(roomInventoryRepository
				.findAllByRoomIdAndInventoryDateGreaterThanEqualAndInventoryDateLessThanOrderByInventoryDateAsc(
						room.getId(),
						CHECK_IN,
						CHECK_OUT
				))
				.extracting(RoomInventory::getReservedQuantity)
				.containsOnly(0);
	}
}
