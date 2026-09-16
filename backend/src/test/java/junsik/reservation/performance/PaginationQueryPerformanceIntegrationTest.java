package junsik.reservation.performance;

import static org.assertj.core.api.Assertions.assertThat;
import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.MemberFixture.member;
import static junsik.reservation.support.RoomFixture.room;

import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.member.Member;
import junsik.reservation.entity.room.Room;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.MemberRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.support.MySqlIntegrationTestSupport;

@Transactional
class PaginationQueryPerformanceIntegrationTest extends MySqlIntegrationTestSupport {

	private static final Logger log = LoggerFactory.getLogger(
			PaginationQueryPerformanceIntegrationTest.class
	);
	private static final int DATASET_SIZE = 10_000;
	private static final int PAGE_SIZE = 20;
	private static final int DEEP_OFFSET = 8_000;
	private static final Pattern ACTUAL_ROWS = Pattern.compile(
			"actual time=[^)]* rows=([0-9.]+) loops="
	);

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private MemberRepository memberRepository;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private RoomRepository roomRepository;

	@Test
	@Timeout(90)
	void comparesDeepOffsetCountAndKeysetExecutionPlans() {
		Member member = memberRepository.saveAndFlush(member(unique("pagination") + "@example.com"));
		Accommodation accommodation = accommodationRepository.saveAndFlush(
				accommodation("Pagination Accommodation " + unique("accommodation"))
		);
		Room room = roomRepository.saveAndFlush(room(accommodation));
		insertReservations(member.getId(), room.getId());

		Long cursor = jdbcTemplate.queryForObject(
				"""
				select id
				from reservations
				where member_id = ?
				order by id desc
				limit 1 offset ?
				""",
				Long.class,
				member.getId(),
				DEEP_OFFSET - 1
		);

		String firstOffsetPlan = explainAnalyze(
				"select id from reservations where member_id = ? order by id desc limit 20 offset 0",
				member.getId()
		);
		String deepOffsetPlan = explainAnalyze(
				"select id from reservations where member_id = ? order by id desc limit 20 offset 8000",
				member.getId()
		);
		String countPlan = explainAnalyze(
				"select count(*) from reservations where member_id = ?",
				member.getId()
		);
		String keysetPlan = explainAnalyze(
				"select id from reservations where member_id = ? and id < ? order by id desc limit 20",
				member.getId(),
				cursor
		);
		log.info("First page Offset EXPLAIN ANALYZE: {}", firstOffsetPlan);
		log.info("Deep Offset EXPLAIN ANALYZE: {}", deepOffsetPlan);
		log.info("Count EXPLAIN ANALYZE: {}", countPlan);
		log.info("Keyset EXPLAIN ANALYZE: {}", keysetPlan);

		List<Long> keysetPage = jdbcTemplate.queryForList(
				"""
				select id
				from reservations
				where member_id = ? and id < ?
				order by id desc
				limit 20
				""",
				Long.class,
				member.getId(),
				cursor
		);

		assertThat(firstOffsetPlan).contains("idx_reservations_member_id");
		assertThat(deepOffsetPlan).contains("idx_reservations_member_id");
		assertThat(countPlan).contains("idx_reservations_member_id");
		assertThat(keysetPlan).contains("idx_reservations_member_id");
		assertThat(maximumActualRows(deepOffsetPlan))
				.isGreaterThan(maximumActualRows(firstOffsetPlan) * 100)
				.isGreaterThan(maximumActualRows(keysetPlan) * 100);
		assertThat(maximumActualRows(countPlan)).isGreaterThanOrEqualTo(DATASET_SIZE);
		assertThat(keysetPage)
				.hasSize(PAGE_SIZE)
				.allMatch(id -> id < cursor)
				.isSortedAccordingTo((left, right) -> Long.compare(right, left));
	}

	private void insertReservations(Long memberId, Long roomId) {
		jdbcTemplate.execute("set session cte_max_recursion_depth = 12000");
		String reservationNumberPrefix = unique("P").substring(0, 8).toUpperCase();
		try {
			jdbcTemplate.update(
					"""
					insert into reservations (
					    reservation_number, member_id, room_id, guest_count,
					    check_in_date, check_out_date,
					    nightly_price_snapshot, total_amount, status
					)
					with recursive sequence(n) as (
					    select 1
					    union all
					    select n + 1 from sequence where n < ?
					)
					select concat('RSV-20300101-', ?, lpad(n, 8, '0')),
					       ?, ?, 1, '2030-01-10', '2030-01-11', 100000.00, 100000.00, 'CONFIRMED'
					from sequence
					""",
					DATASET_SIZE,
					reservationNumberPrefix,
					memberId,
					roomId
			);
		} finally {
			jdbcTemplate.execute("set session cte_max_recursion_depth = 1000");
		}
	}

	private String explainAnalyze(String query, Object... arguments) {
		return jdbcTemplate.queryForObject("explain analyze " + query, String.class, arguments);
	}

	private double maximumActualRows(String plan) {
		Matcher matcher = ACTUAL_ROWS.matcher(plan);
		double maximum = 0;
		while (matcher.find()) {
			maximum = Math.max(maximum, Double.parseDouble(matcher.group(1)));
		}
		assertThat(maximum)
				.as("EXPLAIN ANALYZE에서 실제 처리 행 수를 찾을 수 있어야 합니다.%n%s", plan)
				.isPositive();
		return maximum;
	}

	private String unique(String prefix) {
		return prefix + UUID.randomUUID().toString().replace("-", "");
	}
}
