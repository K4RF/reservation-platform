package junsik.reservation;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.CatalogMediaFixture.image;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.*;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.CatalogMediaRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.support.MySqlIntegrationTestSupport;

@Transactional
class CatalogMediaMySqlIntegrationTest extends MySqlIntegrationTestSupport {
	@Autowired AccommodationRepository accommodations;
	@Autowired RoomRepository rooms;
	@Autowired CatalogMediaRepository media;
	@Autowired JdbcTemplate jdbc;

	@Test
	void mysqlWindowQueryReturnsOneImagePerOwnerAndStableGallery() {
		var first = accommodations.saveAndFlush(accommodation());
		var second = accommodations.saveAndFlush(accommodation());
		var room = rooms.saveAndFlush(room(first));
		CatalogMedia representative = media.saveAndFlush(image(first, 0));
		media.saveAndFlush(image(first, 0));
		media.saveAndFlush(image(second, 1));
		CatalogMedia roomImage = media.saveAndFlush(image(room, 0));
		for (int i = 0; i < 22; i++) { media.save(image(first, i + 1)); }
		media.flush();
		assertThat(media.findAccommodationImages(List.of(first.getId(), second.getId()), 1))
				.hasSize(2).first().extracting(CatalogMedia::getId).isEqualTo(representative.getId());
		assertThat(media.findAccommodationImages(List.of(first.getId()), 20)).hasSize(20);
		assertThat(media.findRoomImages(List.of(room.getId()), 1)).extracting(CatalogMedia::getId)
				.containsExactly(roomImage.getId());
	}

	@Test
	void mysqlConstraintsRejectInvalidOwnershipOrderDimensionsTextForeignKeysAndDuplicateKeys() {
		var owner = accommodations.saveAndFlush(accommodation());
		var room = rooms.saveAndFlush(room(owner));
		var stored = media.saveAndFlush(image(owner, 0));
		for (String assignment : List.of("accommodation_id=null", "room_id=" + room.getId(),
				"sort_order=-1", "width=0", "height=8193", "byte_size=10485761", "alt_text=' '",
				"rights_record=' '", "source=' '", "accommodation_id=9223372036854775807")) {
			Throwable failure = catchThrowable(() -> jdbc.update(
					"update catalog_media set " + assignment + " where id=?", stored.getId()));
			assertThat(failure).isInstanceOf(org.springframework.dao.DataAccessException.class);
			Throwable cause = ((org.springframework.dao.DataAccessException) failure).getMostSpecificCause();
			assertThat(cause).isInstanceOf(java.sql.SQLException.class);
			assertThat(((java.sql.SQLException) cause).getErrorCode())
					.isEqualTo(assignment.endsWith("9223372036854775807") ? 1452 : 3819);
		}
		var another = media.saveAndFlush(image(owner, 1));
		assertThatThrownBy(() -> jdbc.update("update catalog_media set storage_key=? where id=?",
				stored.getStorageKey(), another.getId())).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
	}

	@Test
	@org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
	void reviewedUpgradeSqlCreatesMatchingConstraintsInIsolatedTestTable() throws Exception {
		String sql = java.nio.file.Files.readString(java.nio.file.Path.of("../docs/erd/mysql-catalog-media-upgrade.sql"))
				.replace("catalog_media", "catalog_media_upgradecheck");
		try {
			jdbc.execute(sql);
			assertThat(jdbc.queryForObject("""
					select count(*) from information_schema.table_constraints
					where table_schema=database() and table_name='catalog_media_upgradecheck' and constraint_type='CHECK'
					""", Integer.class)).isEqualTo(4);
		} finally {
			jdbc.execute("drop table if exists catalog_media_upgradecheck");
		}
	}
}
