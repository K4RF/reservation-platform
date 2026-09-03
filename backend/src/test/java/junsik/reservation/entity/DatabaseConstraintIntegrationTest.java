package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.RoomRepository;

@SpringBootTest
@Transactional
class DatabaseConstraintIntegrationTest {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Test
	void enforcesMemberRequiredUniqueAndEnumConstraints() {
		Member member = saveMember("member@example.com");

		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into members (email, password, role) values (?, ?, ?)",
				member.getEmail(),
				"other-password",
				"USER"
		));
		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into members (email, password, role) values (?, ?, ?)",
				null,
				"encoded-password",
				"USER"
		));
		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into members (email, password, role) values (?, ?, ?)",
				"invalid-role@example.com",
				"encoded-password",
				"OWNER"
		));
	}

	@Test
	void enforcesSocialAccountForeignKeyUniqueAndRequiredTextConstraints() {
		Member member = saveMember("member@example.com");
		jdbcTemplate.update(
				"insert into social_accounts (member_id, provider, provider_user_id) values (?, ?, ?)",
				member.getId(),
				"GOOGLE",
				"google-user-1"
		);

		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into social_accounts (member_id, provider, provider_user_id) values (?, ?, ?)",
				member.getId(),
				"GOOGLE",
				"google-user-2"
		));
		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into social_accounts (member_id, provider, provider_user_id) values (?, ?, ?)",
				999999L,
				"GOOGLE",
				"unknown-member"
		));
		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into social_accounts (member_id, provider, provider_user_id) values (?, ?, ?)",
				member.getId(),
				"GOOGLE",
				"   "
		));
	}

	@Test
	void enforcesAccommodationRequiredTextAndColumnLengthConstraints() {
		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into accommodations (name, description, address, status) values (?, ?, ?, ?)",
				"   ",
				"description",
				"address",
				"ACTIVE"
		));
		assertConstraintViolation(() -> jdbcTemplate.update(
				"insert into accommodations (name, description, address, status) values (?, ?, ?, ?)",
				"x".repeat(101),
				"description",
				"address",
				"ACTIVE"
		));
	}

	@Test
	void enforcesRoomForeignKeyAndBusinessValueConstraints() {
		Accommodation accommodation = saveAccommodation();

		assertConstraintViolation(() -> insertRoom(999999L, "Room", 2, new BigDecimal("100000.00")));
		assertConstraintViolation(() -> insertRoom(accommodation.getId(), "Room", 0, new BigDecimal("100000.00")));
		assertConstraintViolation(() -> insertRoom(accommodation.getId(), "Room", 2, new BigDecimal("-0.01")));
		assertConstraintViolation(() -> insertRoom(accommodation.getId(), "   ", 2, new BigDecimal("100000.00")));
	}

	@Test
	void enforcesReservationForeignKeysPeriodAndAmountConstraints() {
		Member member = saveMember("member@example.com");
		Room room = saveRoom(saveAccommodation());

		assertConstraintViolation(() -> insertReservation(
				999999L,
				room.getId(),
				LocalDate.of(2030, 1, 1),
				LocalDate.of(2030, 1, 2),
				new BigDecimal("100000.00"),
				new BigDecimal("100000.00")
		));
		assertConstraintViolation(() -> insertReservation(
				member.getId(),
				room.getId(),
				LocalDate.of(2030, 1, 2),
				LocalDate.of(2030, 1, 2),
				new BigDecimal("100000.00"),
				new BigDecimal("100000.00")
		));
		assertConstraintViolation(() -> insertReservation(
				member.getId(),
				room.getId(),
				LocalDate.of(2030, 1, 1),
				LocalDate.of(2030, 1, 2),
				new BigDecimal("-0.01"),
				new BigDecimal("-0.01")
		));
	}

	private Member saveMember(String email) {
		return memberRepository.saveAndFlush(Member.createUser(email, "encoded-password"));
	}

	private Accommodation saveAccommodation() {
		return accommodationRepository.saveAndFlush(Accommodation.create(
				"Ocean View Hotel",
				"Accommodation description",
				"Accommodation address"
		));
	}

	private Room saveRoom(Accommodation accommodation) {
		return roomRepository.saveAndFlush(Room.create(
				accommodation,
				"Deluxe Room",
				2,
				new BigDecimal("100000.00")
		));
	}

	private void insertRoom(Long accommodationId, String name, int capacity, BigDecimal nightlyPrice) {
		jdbcTemplate.update(
				"insert into rooms (accommodation_id, name, capacity, nightly_price, status) values (?, ?, ?, ?, ?)",
				accommodationId,
				name,
				capacity,
				nightlyPrice,
				"ACTIVE"
		);
	}

	private void insertReservation(
			Long memberId,
			Long roomId,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			BigDecimal nightlyPriceSnapshot,
			BigDecimal totalAmount
	) {
		jdbcTemplate.update(
				"""
				insert into reservations (
				    member_id, room_id, check_in_date, check_out_date,
				    nightly_price_snapshot, total_amount, status
				) values (?, ?, ?, ?, ?, ?, ?)
				""",
				memberId,
				roomId,
				checkInDate,
				checkOutDate,
				nightlyPriceSnapshot,
				totalAmount,
				"CONFIRMED"
		);
	}

	private void assertConstraintViolation(Runnable operation) {
		assertThatThrownBy(operation::run)
				.isInstanceOf(DataIntegrityViolationException.class);
	}
}
