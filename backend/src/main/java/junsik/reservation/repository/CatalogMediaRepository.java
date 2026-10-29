package junsik.reservation.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import junsik.reservation.entity.media.CatalogMedia;

public interface CatalogMediaRepository extends JpaRepository<CatalogMedia, Long> {

	// Rank inside each owner before filtering: one bounded query per page, not per card.
	@Query(value = """
			select m.* from catalog_media m join (
			  select id, row_number() over (partition by accommodation_id order by sort_order, id) as media_rank
			  from catalog_media where accommodation_id in (:ids)
			) ranked on ranked.id = m.id where ranked.media_rank <= :limit
			order by m.accommodation_id, m.sort_order, m.id
			""", nativeQuery = true)
	List<CatalogMedia> findAccommodationImages(@Param("ids") List<Long> ids, @Param("limit") int limit);

	@Query(value = """
			select m.* from catalog_media m join (
			  select id, row_number() over (partition by room_id order by sort_order, id) as media_rank
			  from catalog_media where room_id in (:ids)
			) ranked on ranked.id = m.id where ranked.media_rank <= :limit
			order by m.room_id, m.sort_order, m.id
			""", nativeQuery = true)
	List<CatalogMedia> findRoomImages(@Param("ids") List<Long> ids, @Param("limit") int limit);
}
