package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.AuthenticationTestSupport.bearerToken;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.AccommodationCancellationPolicy;
import junsik.reservation.entity.CancellationFeeRule;
import junsik.reservation.entity.CancellationPolicySnapshot;
import junsik.reservation.entity.Member;
import junsik.reservation.entity.Reservation;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationCancellationPolicyRepository;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.ReservationRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;
import junsik.reservation.service.ReservationDateProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class CancellationPolicySnapshotIntegrationTest {

	private static final LocalDate TODAY = LocalDate.of(2030, 1, 1);
	private static final Instant NOW = Instant.parse("2030-01-01T03:00:00Z");
	private static final LocalDate CHECK_IN = TODAY.plusDays(5);
	private static final LocalDate CHECK_OUT = CHECK_IN.plusDays(2);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private AccommodationCancellationPolicyRepository cancellationPolicyRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

	@Autowired
	private ReservationRepository reservationRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Autowired
	private EntityManager entityManager;

	@MockitoBean
	private ReservationDateProvider dateProvider;

	@BeforeEach
	void setUpDate() {
		given(dateProvider.today()).willReturn(TODAY);
		given(dateProvider.now()).willReturn(NOW);
	}

	@Test
	void existingReservationKeepsOriginalPolicyAfterAccommodationPolicyChanges() throws Exception {
		Member savedMember = memberRepository.saveAndFlush(member("snapshot@example.com"));
		Accommodation savedAccommodation = accommodationRepository.saveAndFlush(accommodation());
		Room savedRoom = roomRepository.saveAndFlush(room(savedAccommodation));
		saveInventories(savedRoom);
		AccommodationCancellationPolicy policy = cancellationPolicyRepository.saveAndFlush(
				AccommodationCancellationPolicy.create(savedAccommodation, policy(30, 50))
		);

		performCreate(savedMember, savedRoom)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.cancellationPolicySnapshot.feeRules[0].feeRatePercent").value(30));
		Long originalReservationId = reservationRepository.findAll().getFirst().getId();

		policy.update(policy(80, 90));
		cancellationPolicyRepository.flush();
		entityManager.clear();

		mockMvc.perform(patch("/api/v1/reservations/{reservationId}/cancel", originalReservationId)
					.header("Authorization", bearerToken(
							jwtTokenProvider,
							savedMember.getId(),
							MemberRole.USER
					)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cancellationFeeRate").value(30));

		performCreate(savedMember, savedRoom)
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.cancellationPolicySnapshot.feeRules[0].feeRatePercent").value(80));
		Reservation newestReservation = reservationRepository.findAll().stream()
				.filter(reservation -> !reservation.getId().equals(originalReservationId))
				.findFirst()
				.orElseThrow();

		mockMvc.perform(patch("/api/v1/reservations/{reservationId}/cancel", newestReservation.getId())
					.header("Authorization", bearerToken(
							jwtTokenProvider,
							savedMember.getId(),
							MemberRole.USER
					)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cancellationFeeRate").value(80));
	}

	private CancellationPolicySnapshot policy(int earlyRate, int lateRate) {
		return new CancellationPolicySnapshot(
				7,
				1,
				List.of(
						CancellationFeeRule.create(3, earlyRate),
						CancellationFeeRule.create(1, lateRate)
				)
		);
	}

	private void saveInventories(Room room) {
		CHECK_IN.datesUntil(CHECK_OUT).forEach(date ->
				roomInventoryRepository.save(RoomInventory.create(room, date, 10)));
		roomInventoryRepository.flush();
	}

	private org.springframework.test.web.servlet.ResultActions performCreate(Member member, Room room)
			throws Exception {
		return mockMvc.perform(post("/api/v1/reservations")
				.header("Authorization", bearerToken(jwtTokenProvider, member.getId(), MemberRole.USER))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{
						  "roomId": %d,
						  "guestCount": 1,
						  "checkInDate": "%s",
						  "checkOutDate": "%s",
						  "representativeGuest": {
						    "name": "Test Guest",
						    "email": "guest@example.com",
						    "phone": "010-1234-5678"
						  }
						}
						""".formatted(room.getId(), CHECK_IN, CHECK_OUT)));
	}
}
