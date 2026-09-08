package junsik.reservation.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;

import java.math.BigDecimal;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.RoomInventoryRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.support.MySqlIntegrationTestSupport;

@Transactional
class DatabaseConstraintIntegrationTest extends MySqlIntegrationTestSupport {

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Autowired
	private RoomInventoryRepository roomInventoryRepository;

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
	void enforcesBookingPolicyForeignKeyUniqueAndRangeConstraints() {
		Accommodation accommodation = saveAccommodation();
		insertBookingPolicy(accommodation.getId(), 2, 14, 1, 365);

		assertConstraintViolation(() -> insertBookingPolicy(accommodation.getId(), 1, 10, 0, 180));
		assertConstraintViolation(() -> insertBookingPolicy(999999L, 1, 10, 0, 180));
		assertConstraintViolation(() -> insertBookingPolicy(
				saveAccommodation().getId(), 0, 10, 0, 180
		));
		assertConstraintViolation(() -> insertBookingPolicy(
				saveAccommodation().getId(), 5, 4, 0, 180
		));
		assertConstraintViolation(() -> insertBookingPolicy(
				saveAccommodation().getId(), 1, 10, -1, 180
		));
		assertConstraintViolation(() -> insertBookingPolicy(
				saveAccommodation().getId(), 1, 10, 30, 29
		));
	}

	@Test
	void enforcesCancellationPolicyAndFeeRuleConstraints() {
		Accommodation accommodation = saveAccommodation();
		insertCancellationPolicy(accommodation.getId(), 7, 1);
		Long policyId = jdbcTemplate.queryForObject(
				"select id from accommodation_cancellation_policies where accommodation_id = ?",
				Long.class,
				accommodation.getId()
		);
		insertCancellationFeeRule(policyId, 0, 3, 30);

		assertConstraintViolation(() -> insertCancellationPolicy(accommodation.getId(), 10, 1));
		assertConstraintViolation(() -> insertCancellationPolicy(999999L, 7, 1));
		assertConstraintViolation(() -> insertCancellationPolicy(
				saveAccommodation().getId(), 1, 1
		));
		assertConstraintViolation(() -> insertCancellationPolicy(
				saveAccommodation().getId(), 7, -1
		));
		assertConstraintViolation(() -> insertCancellationFeeRule(policyId, 1, -1, 30));
		assertConstraintViolation(() -> insertCancellationFeeRule(policyId, 1, 1, 0));
		assertConstraintViolation(() -> insertCancellationFeeRule(policyId, 1, 1, 101));
		assertConstraintViolation(() -> insertCancellationFeeRule(999999L, 0, 1, 50));

		Member member = saveMember("cancellation-snapshot@example.com");
		Room room = saveRoom(saveAccommodation());
		insertReservation(
				member.getId(),
				room.getId(),
				LocalDate.of(2030, 1, 10),
				LocalDate.of(2030, 1, 12),
				new BigDecimal("100000.00"),
				new BigDecimal("200000.00")
		);
		Long reservationId = jdbcTemplate.queryForObject(
				"select max(id) from reservations where member_id = ?",
				Long.class,
				member.getId()
		);
		insertReservationCancellationFeeSnapshot(reservationId, 0, 3, 30);
		assertConstraintViolation(() -> insertReservationCancellationFeeSnapshot(
				reservationId, 0, 1, 50
		));
		assertConstraintViolation(() -> insertReservationCancellationFeeSnapshot(
				999999L, 0, 1, 50
		));
		assertConstraintViolation(() -> jdbcTemplate.update(
				"""
				update reservations
				set free_cancellation_days_before_check_in = 1,
				    cancellation_deadline_days_before_check_in = 1
				where id = ?
				""",
				reservationId
		));
	}

	@Test
	void enforcesRoomInventoryForeignKeyUniqueAndQuantityConstraints() {
		Room room = saveRoom(saveAccommodation());
		LocalDate inventoryDate = LocalDate.of(2030, 1, 1);
		insertRoomInventory(room.getId(), inventoryDate, 3, 1);

		assertConstraintViolation(() -> insertRoomInventory(room.getId(), inventoryDate, 3, 0));
		assertConstraintViolation(() -> insertRoomInventory(999999L, inventoryDate.plusDays(1), 3, 0));
		assertConstraintViolation(() -> insertRoomInventory(room.getId(), inventoryDate.plusDays(1), -1, 0));
		assertConstraintViolation(() -> insertRoomInventory(room.getId(), inventoryDate.plusDays(1), 1, 2));
		assertConstraintViolation(() -> insertRoomInventory(room.getId(), null, 1, 0));
		assertConstraintViolation(() -> jdbcTemplate.update(
				"""
				insert into room_inventories (
				    room_id, inventory_date, total_quantity, reserved_quantity, sale_status
				) values (?, ?, ?, ?, ?)
				""",
				room.getId(),
				inventoryDate.plusDays(2),
				1,
				0,
				"PAUSED"
		));
	}

	@Test
	void enforcesRoomDailyPriceForeignKeyUniqueAndPositivePriceConstraints() {
		Room room = saveRoom(saveAccommodation());
		LocalDate stayDate = LocalDate.of(2030, 7, 20);
		insertRoomDailyPrice(room.getId(), stayDate, new BigDecimal("180000.00"));

		assertConstraintViolation(() -> insertRoomDailyPrice(
				room.getId(), stayDate, new BigDecimal("190000.00")
		));
		assertConstraintViolation(() -> insertRoomDailyPrice(
				999999L, stayDate.plusDays(1), new BigDecimal("180000.00")
		));
		assertConstraintViolation(() -> insertRoomDailyPrice(
				room.getId(), stayDate.plusDays(1), BigDecimal.ZERO
		));
		assertConstraintViolation(() -> insertRoomDailyPrice(
				room.getId(), stayDate.plusDays(1), new BigDecimal("-0.01")
		));
		assertConstraintViolation(() -> insertRoomDailyPrice(
				room.getId(), null, new BigDecimal("180000.00")
		));
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
		assertConstraintViolation(() -> insertReservation(
				member.getId(),
				room.getId(),
				0,
				LocalDate.of(2030, 1, 1),
				LocalDate.of(2030, 1, 2),
				new BigDecimal("100000.00"),
				new BigDecimal("100000.00")
		));
	}

	@Test
	void explainsIntegratedAccommodationSearchUsingCurrentIndexes() {
		LocalDate checkInDate = LocalDate.of(2030, 1, 10);
		LocalDate checkOutDate = LocalDate.of(2030, 1, 13);
		Accommodation accommodation = accommodationRepository.saveAndFlush(
				accommodation("Ocean Hotel", "Description", "서울 강남구")
		);
		Room room = saveRoom(accommodation);
		checkInDate.datesUntil(checkOutDate).forEach(date -> roomInventoryRepository.save(
				RoomInventory.create(room, date, 2)
		));
		roomInventoryRepository.flush();

		String plan = jdbcTemplate.queryForObject(
				"""
				EXPLAIN FORMAT=TREE
				SELECT accommodation.id, accommodation.name
				FROM accommodations accommodation
				WHERE lower(accommodation.name) LIKE ?
				  AND lower(accommodation.address) LIKE ?
				  AND accommodation.status = 'ACTIVE'
				  AND EXISTS (
				      SELECT 1
				      FROM rooms room
				      WHERE room.accommodation_id = accommodation.id
				        AND room.status = 'ACTIVE'
				        AND room.capacity >= ?
				        AND room.nightly_price BETWEEN ? AND ?
				        AND ? = (
				            SELECT count(*)
				            FROM room_inventories inventory
					            WHERE inventory.room_id = room.id
					              AND inventory.inventory_date >= ?
					              AND inventory.inventory_date < ?
					              AND inventory.sale_status = 'OPEN'
					              AND inventory.total_quantity > inventory.reserved_quantity
				        )
				  )
				ORDER BY accommodation.name, accommodation.id
				LIMIT 20
				""",
				String.class,
				"%hotel%",
				"%서울%",
				2,
				100_000,
				200_000,
				3,
				checkInDate,
				checkOutDate
		);

		assertThat(plan)
				.contains("Table scan on room")
				.contains("Single-row index lookup on accommodation using PRIMARY")
				.contains("inventory")
				.contains("uk_room_inventories_room_date");
	}

	private Member saveMember(String email) {
		return memberRepository.saveAndFlush(member(email));
	}

	private Accommodation saveAccommodation() {
		return accommodationRepository.saveAndFlush(accommodation());
	}

	private Room saveRoom(Accommodation accommodation) {
		return roomRepository.saveAndFlush(room(accommodation));
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

	private void insertBookingPolicy(
			Long accommodationId,
			int minStayNights,
			int maxStayNights,
			int minAdvanceBookingDays,
			int maxAdvanceBookingDays
	) {
		jdbcTemplate.update(
				"""
				insert into accommodation_booking_policies (
				    accommodation_id, min_stay_nights, max_stay_nights,
				    min_advance_booking_days, max_advance_booking_days
				) values (?, ?, ?, ?, ?)
				""",
				accommodationId,
				minStayNights,
				maxStayNights,
				minAdvanceBookingDays,
				maxAdvanceBookingDays
		);
	}

	private void insertCancellationPolicy(
			Long accommodationId,
			int freeCancellationDays,
			int cancellationDeadlineDays
	) {
		jdbcTemplate.update(
				"""
				insert into accommodation_cancellation_policies (
				    accommodation_id, free_cancellation_days_before_check_in,
				    cancellation_deadline_days_before_check_in
				) values (?, ?, ?)
				""",
				accommodationId,
				freeCancellationDays,
				cancellationDeadlineDays
		);
	}

	private void insertCancellationFeeRule(
			Long policyId,
			int ruleOrder,
			int minDaysBeforeCheckIn,
			int feeRatePercent
	) {
		jdbcTemplate.update(
				"""
				insert into cancellation_policy_fee_rules (
				    cancellation_policy_id, rule_order, min_days_before_check_in, fee_rate_percent
				) values (?, ?, ?, ?)
				""",
				policyId,
				ruleOrder,
				minDaysBeforeCheckIn,
				feeRatePercent
		);
	}

	private void insertReservationCancellationFeeSnapshot(
			Long reservationId,
			int ruleOrder,
			int minDaysBeforeCheckIn,
			int feeRatePercent
	) {
		jdbcTemplate.update(
				"""
				insert into reservation_cancellation_fee_snapshots (
				    reservation_id, rule_order, min_days_before_check_in, fee_rate_percent
				) values (?, ?, ?, ?)
				""",
				reservationId,
				ruleOrder,
				minDaysBeforeCheckIn,
				feeRatePercent
		);
	}

	private void insertRoomInventory(
			Long roomId,
			LocalDate inventoryDate,
			int totalQuantity,
			int reservedQuantity
	) {
		jdbcTemplate.update(
				"""
				insert into room_inventories (room_id, inventory_date, total_quantity, reserved_quantity)
				values (?, ?, ?, ?)
				""",
				roomId,
				inventoryDate,
				totalQuantity,
				reservedQuantity
		);
	}

	private void insertRoomDailyPrice(Long roomId, LocalDate stayDate, BigDecimal nightlyPrice) {
		jdbcTemplate.update(
				"insert into room_daily_prices (room_id, stay_date, nightly_price) values (?, ?, ?)",
				roomId,
				stayDate,
				nightlyPrice
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
		insertReservation(
				memberId,
				roomId,
				1,
				checkInDate,
				checkOutDate,
				nightlyPriceSnapshot,
				totalAmount
		);
	}

	private void insertReservation(
			Long memberId,
			Long roomId,
			int guestCount,
			LocalDate checkInDate,
			LocalDate checkOutDate,
			BigDecimal nightlyPriceSnapshot,
			BigDecimal totalAmount
	) {
		jdbcTemplate.update(
				"""
				insert into reservations (
				    member_id, room_id, guest_count, check_in_date, check_out_date,
				    nightly_price_snapshot, total_amount, status
				) values (?, ?, ?, ?, ?, ?, ?, ?)
				""",
				memberId,
				roomId,
				guestCount,
				checkInDate,
				checkOutDate,
				nightlyPriceSnapshot,
				totalAmount,
				"CONFIRMED"
		);
	}

	private void assertConstraintViolation(Runnable operation) {
		assertThatThrownBy(operation::run)
				.isInstanceOf(DataAccessException.class);
	}
}
