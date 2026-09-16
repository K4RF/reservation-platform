package junsik.reservation.performance;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import junsik.reservation.support.MySqlIntegrationTestSupport;

class SearchQueryExecutionPlanIntegrationTest extends MySqlIntegrationTestSupport {

	private static final Logger log = LoggerFactory.getLogger(
			SearchQueryExecutionPlanIntegrationTest.class
	);
	private static final String ACCOMMODATION_BASELINE_INDEX =
			"idx_accommodations_city_region_baseline";
	private static final String ACCOMMODATION_OPTIMIZED_INDEX =
			"idx_accommodations_city_region_status_id";
	private static final String ROOM_BASELINE_INDEX = "idx_rooms_accommodation_baseline";
	private static final String ROOM_OPTIMIZED_INDEX = "idx_rooms_accommodation_status_id";
	private static final String INVENTORY_INDEX = "uk_room_inventories_room_date";
	private static final int ACCOMMODATION_COUNT = 200;
	private static final int ROOM_COUNT = 400;
	private static final int STAY_NIGHTS = 3;
	private static final LocalDate CHECK_IN_DATE = LocalDate.of(2035, 6, 1);
	private static final LocalDate CHECK_OUT_DATE = CHECK_IN_DATE.plusDays(STAY_NIGHTS);

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	@Timeout(90)
	void comparesSearchExecutionPlansBeforeAndAfterCompositeIndexes() {
		String fixtureKey = UUID.randomUUID().toString();
		String city = "PlanCity-" + fixtureKey;
		String region = "PlanRegion-" + fixtureKey;
		try {
			Long accommodationId = createFixture(fixtureKey, city, region);

			installBaselineIndexes();
			jdbcTemplate.execute("ANALYZE TABLE accommodations, rooms, room_inventories");
			PlanRow accommodationBefore = explainAccommodationSearch(city, region);
			PlanRow roomBefore = explainRoomSearch(accommodationId);
			List<PlanRow> availabilityBefore = explainAvailabilitySearch(accommodationId);
			List<Map<String, Object>> accommodationAnalyzeBefore =
					analyzeAccommodationSearch(city, region);
			List<Map<String, Object>> roomAnalyzeBefore = analyzeRoomSearch(accommodationId);
			List<Map<String, Object>> availabilityAnalyzeBefore =
					analyzeAvailabilitySearch(accommodationId);

			installOptimizedIndexes();
			jdbcTemplate.execute("ANALYZE TABLE accommodations, rooms, room_inventories");
			PlanRow accommodationAfter = explainAccommodationSearch(city, region);
			PlanRow roomAfter = explainRoomSearch(accommodationId);
			List<PlanRow> availabilityAfter = explainAvailabilitySearch(accommodationId);

			log.info("Accommodation search plan before: {}", accommodationBefore);
			log.info("Accommodation search plan after: {}", accommodationAfter);
			log.info("Room search plan before: {}", roomBefore);
			log.info("Room search plan after: {}", roomAfter);
			log.info("Availability search plan before: {}", availabilityBefore);
			log.info("Availability search plan after: {}", availabilityAfter);

			assertThat(accommodationBefore.key()).isEqualTo(ACCOMMODATION_BASELINE_INDEX);
			assertThat(accommodationAfter.key()).isEqualTo(ACCOMMODATION_OPTIMIZED_INDEX);
			assertThat(accommodationAfter.estimatedRows())
					.isLessThanOrEqualTo(accommodationBefore.estimatedRows());
			assertThat(roomBefore.key()).isNotEqualTo(ROOM_OPTIMIZED_INDEX);
			assertThat(roomAfter.key()).isEqualTo(ROOM_OPTIMIZED_INDEX);
			assertThat(roomAfter.estimatedRows()).isLessThanOrEqualTo(roomBefore.estimatedRows());
			assertThat(accommodationAfter.extra()).doesNotContainIgnoringCase("filesort");
			assertThat(roomAfter.extra()).doesNotContainIgnoringCase("filesort");
			assertThat(availabilityAfter).allSatisfy(row ->
					assertThat(row.accessType()).isNotEqualTo("ALL")
			);
			assertThat(availabilityAfter).anySatisfy(row -> {
				assertThat(row.table()).isEqualTo("i");
				assertThat(row.key()).isEqualTo(INVENTORY_INDEX);
			});
			log.info("Accommodation EXPLAIN ANALYZE before: {}", accommodationAnalyzeBefore);
			log.info(
					"Accommodation EXPLAIN ANALYZE after: {}",
					analyzeAccommodationSearch(city, region)
			);
			log.info("Room EXPLAIN ANALYZE before: {}", roomAnalyzeBefore);
			log.info("Room EXPLAIN ANALYZE after: {}", analyzeRoomSearch(accommodationId));
			log.info("Availability EXPLAIN ANALYZE before: {}", availabilityAnalyzeBefore);
			log.info(
					"Availability EXPLAIN ANALYZE after: {}",
					analyzeAvailabilitySearch(accommodationId)
			);
		} finally {
			installOptimizedIndexes();
			deleteFixture(fixtureKey);
		}
	}

	private Long createFixture(String fixtureKey, String city, String region) {
		List<Object[]> accommodations = IntStream.range(0, ACCOMMODATION_COUNT)
				.mapToObj(index -> new Object[]{
						"Plan Fixture " + fixtureKey + " " + index,
						"Execution plan fixture",
						"KR",
						index < ACCOMMODATION_COUNT / 5
								? city
								: "OtherCity-" + fixtureKey + "-" + index % 20,
						region,
						"Plan address " + index,
						index % 2 == 0 ? "ACTIVE" : "INACTIVE",
						"Asia/Seoul"
				})
				.toList();
		jdbcTemplate.batchUpdate("""
				insert into accommodations (
				    name, description, country, city, region, address, status, time_zone
				) values (?, ?, ?, ?, ?, ?, ?, ?)
				""", accommodations);
		Long accommodationId = jdbcTemplate.queryForObject("""
				select min(id)
				from accommodations
				where name like ? and status = 'ACTIVE'
				""", Long.class, "Plan Fixture " + fixtureKey + "%");

		List<Object[]> rooms = IntStream.range(0, ROOM_COUNT)
				.mapToObj(index -> new Object[]{
						accommodationId,
						"Plan Room " + fixtureKey + " " + index,
						2 + index % 4,
						new BigDecimal("100000.00").add(BigDecimal.valueOf(index % 100)),
						index % 2 == 0 ? "ACTIVE" : "INACTIVE"
				})
				.toList();
		jdbcTemplate.batchUpdate("""
				insert into rooms (accommodation_id, name, capacity, nightly_price, status)
				values (?, ?, ?, ?, ?)
				""", rooms);

		List<Long> roomIds = jdbcTemplate.queryForList("""
				select id from rooms where name like ? order by id
				""", Long.class, "Plan Room " + fixtureKey + "%");
		List<Object[]> inventories = new ArrayList<>(ROOM_COUNT * STAY_NIGHTS);
		for (Long roomId : roomIds) {
			CHECK_IN_DATE.datesUntil(CHECK_OUT_DATE).forEach(date -> inventories.add(new Object[]{
					roomId,
					Date.valueOf(date),
					3,
					0,
					0,
					"OPEN"
			}));
		}
		jdbcTemplate.batchUpdate("""
				insert into room_inventories (
				    room_id, inventory_date, total_quantity, reserved_quantity, version, sale_status
				) values (?, ?, ?, ?, ?, ?)
				""", inventories);
		return accommodationId;
	}

	private PlanRow explainAccommodationSearch(String city, String region) {
		return explain("""
				select id, name, status
				from accommodations
				where city = ? and region = ? and status = 'ACTIVE'
				order by id
				limit 20
				""", city, region).getFirst();
	}

	private PlanRow explainRoomSearch(Long accommodationId) {
		return explain("""
				select id, name, capacity, nightly_price, status
				from rooms
				where accommodation_id = ? and status = 'ACTIVE'
				order by id
				limit 20
				""", accommodationId).getFirst();
	}

	private List<PlanRow> explainAvailabilitySearch(Long accommodationId) {
		return explain(availabilitySql(""), availabilityArguments(accommodationId));
	}

	private List<PlanRow> explain(String sql, Object... arguments) {
		return jdbcTemplate.queryForList("EXPLAIN " + sql, arguments).stream()
				.map(this::toPlanRow)
				.toList();
	}

	private PlanRow toPlanRow(Map<String, Object> row) {
		return new PlanRow(
				String.valueOf(row.get("table")),
				String.valueOf(row.get("type")),
				row.get("key") == null ? null : String.valueOf(row.get("key")),
				((Number) row.get("rows")).longValue(),
				row.get("Extra") == null ? "" : String.valueOf(row.get("Extra"))
		);
	}

	private List<Map<String, Object>> analyzeAccommodationSearch(String city, String region) {
		return jdbcTemplate.queryForList("EXPLAIN ANALYZE " + """
				select id, name, status
				from accommodations
				where city = ? and region = ? and status = 'ACTIVE'
				order by id
				limit 20
				""", city, region);
	}

	private List<Map<String, Object>> analyzeRoomSearch(Long accommodationId) {
		return jdbcTemplate.queryForList("EXPLAIN ANALYZE " + """
				select id, name, capacity, nightly_price, status
				from rooms
				where accommodation_id = ? and status = 'ACTIVE'
				order by id
				limit 20
				""", accommodationId);
	}

	private List<Map<String, Object>> analyzeAvailabilitySearch(Long accommodationId) {
		return jdbcTemplate.queryForList(
				availabilitySql("EXPLAIN ANALYZE "),
				availabilityArguments(accommodationId)
		);
	}

	private String availabilitySql(String prefix) {
		return prefix + """
				select r.id
				from rooms r
				join accommodations a on a.id = r.accommodation_id
				where r.accommodation_id = ?
				  and a.status = 'ACTIVE'
				  and r.status = 'ACTIVE'
				  and r.capacity >= 2
				  and ? = (
				      select count(i.id)
				      from room_inventories i
				      where i.room_id = r.id
				        and i.inventory_date >= ?
				        and i.inventory_date < ?
				        and i.sale_status = 'OPEN'
				        and i.reserved_quantity < i.total_quantity
				  )
				order by r.id
				limit 20
				""";
	}

	private Object[] availabilityArguments(Long accommodationId) {
		return new Object[]{
				accommodationId,
				STAY_NIGHTS,
				Date.valueOf(CHECK_IN_DATE),
				Date.valueOf(CHECK_OUT_DATE)
		};
	}

	private void installBaselineIndexes() {
		createIndexIfMissing(
				"accommodations",
				ACCOMMODATION_BASELINE_INDEX,
				"city, region"
		);
		dropIndexIfPresent("accommodations", ACCOMMODATION_OPTIMIZED_INDEX);
		createIndexIfMissing("rooms", ROOM_BASELINE_INDEX, "accommodation_id");
		dropIndexIfPresent("rooms", ROOM_OPTIMIZED_INDEX);
	}

	private void installOptimizedIndexes() {
		createIndexIfMissing(
				"accommodations",
				ACCOMMODATION_OPTIMIZED_INDEX,
				"city, region, status, id"
		);
		dropIndexIfPresent("accommodations", ACCOMMODATION_BASELINE_INDEX);
		createIndexIfMissing("rooms", ROOM_OPTIMIZED_INDEX, "accommodation_id, status, id");
		dropIndexIfPresent("rooms", ROOM_BASELINE_INDEX);
	}

	private void createIndexIfMissing(String table, String index, String columns) {
		if (!indexExists(table, index)) {
			jdbcTemplate.execute("create index " + index + " on " + table + " (" + columns + ")");
		}
	}

	private void dropIndexIfPresent(String table, String index) {
		if (indexExists(table, index)) {
			jdbcTemplate.execute("drop index " + index + " on " + table);
		}
	}

	private boolean indexExists(String table, String index) {
		Integer count = jdbcTemplate.queryForObject("""
				select count(*)
				from information_schema.statistics
				where table_schema = database()
				  and table_name = ?
				  and index_name = ?
				""", Integer.class, table, index);
		return count != null && count > 0;
	}

	private void deleteFixture(String fixtureKey) {
		String roomPattern = "Plan Room " + fixtureKey + "%";
		jdbcTemplate.update("""
				delete from room_inventories
				where room_id in (select id from rooms where name like ?)
				""", roomPattern);
		jdbcTemplate.update("delete from rooms where name like ?", roomPattern);
		jdbcTemplate.update(
				"delete from accommodations where name like ?",
				"Plan Fixture " + fixtureKey + "%"
		);
	}

	private record PlanRow(
			String table,
			String accessType,
			String key,
			long estimatedRows,
			String extra
	) {
	}
}
