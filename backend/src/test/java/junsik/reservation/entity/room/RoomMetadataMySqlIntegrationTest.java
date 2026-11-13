package junsik.reservation.entity.room;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.List;

import jakarta.persistence.EntityManager;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.support.MySqlIntegrationTestSupport;

class RoomMetadataMySqlIntegrationTest extends MySqlIntegrationTestSupport {

	@Autowired JdbcTemplate jdbc;
	@Autowired AccommodationRepository accommodations;
	@Autowired RoomRepository rooms;
	@Autowired EntityManager entityManager;

	@Test
	@Transactional
	void mapsOptionalMetadataAndEnforcesFreshSchemaChecks() {
		Room room = rooms.saveAndFlush(room(accommodations.saveAndFlush(accommodation())));
		Long id = room.getId();
		entityManager.clear();
		assertThat(rooms.findById(id).orElseThrow().getMetadata()).isNull();
		rooms.findById(id).orElseThrow().replaceMetadata(RoomMetadata.of("설명", null, new BigDecimal("28.50"), "바다"));
		entityManager.flush();
		entityManager.clear();
		RoomMetadata metadata = rooms.findById(id).orElseThrow().getMetadata();
		assertThat(metadata.getDescription()).isEqualTo("설명");
		assertThat(metadata.getAreaSquareMeters()).isEqualByComparingTo("28.50");
		assertChecks("rooms", id);
	}

	@Test
	void appliesReviewedSqlToPreMetadataRoomWithoutRewritingExistingColumns() throws Exception {
		String table = "rooms_metadata_upgradecheck";
		jdbc.execute("""
				CREATE TABLE rooms_metadata_upgradecheck (
				    id BIGINT PRIMARY KEY, accommodation_id BIGINT NOT NULL,
				    name VARCHAR(100) NOT NULL, capacity INTEGER NOT NULL,
				    nightly_price DECIMAL(12,2) NOT NULL, status VARCHAR(20) NOT NULL,
				    KEY idx_old_room_catalog (accommodation_id, status, id)
				)
				""");
		try {
			jdbc.update("INSERT INTO " + table + " VALUES (7, 9, '기존 객실', 3, 12345.00, 'INACTIVE')");
			var existing = jdbc.queryForMap("SELECT * FROM " + table + " WHERE id=7");
			String sql = Files.readString(Path.of("../docs/erd/mysql-room-metadata-upgrade.sql"))
					.replace("ALTER TABLE rooms", "ALTER TABLE " + table)
					.replace("chk_rooms_metadata_values", "chk_rooms_upgradecheck_metadata_values");
			jdbc.execute(sql);
			assertThat(jdbc.queryForMap("SELECT * FROM " + table + " WHERE id=7"))
					.containsAllEntriesOf(existing)
					.containsEntry("metadata_description", null)
					.containsEntry("metadata_bed_configuration", null)
					.containsEntry("metadata_area_square_meters", null)
					.containsEntry("metadata_view", null);
			assertThat(jdbc.update("UPDATE " + table + " SET metadata_area_square_meters=9999.99 WHERE id=7")).isEqualTo(1);
			assertThat(jdbc.queryForObject("""
					SELECT COUNT(*) FROM information_schema.statistics
					WHERE table_schema=DATABASE() AND table_name=? AND index_name='idx_old_room_catalog'
					""", Integer.class, table)).isEqualTo(3);
			assertChecks(table, 7L);
		} finally {
			jdbc.execute("DROP TABLE " + table);
		}
	}

	private void assertChecks(String table, Long id) {
		for (String assignment : List.of("metadata_description=' '", "metadata_bed_configuration=''",
				"metadata_area_square_meters=0", "metadata_view=' '")) {
			var failure = catchThrowableOfType(DataAccessException.class,
					() -> jdbc.update("UPDATE " + table + " SET " + assignment + " WHERE id=?", id));
			assertThat(failure).isNotNull();
			assertThat(failure.getMostSpecificCause()).isInstanceOfSatisfying(SQLException.class, cause -> {
				assertThat(cause.getErrorCode()).isEqualTo(3819);
				assertThat(cause.getMessage()).contains("metadata_values");
			});
		}
	}
}
