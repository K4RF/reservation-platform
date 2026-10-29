package junsik.reservation.service.media;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.config.RedisCacheConfig;

/** Call through this Spring proxy inside the Media write transaction (#273).
 * The existing transaction-aware CacheManager defers eviction until commit. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class CatalogMediaCacheEviction {

	@CacheEvict(cacheNames = RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE, key = "#p0")
	public void accommodationChanged(Long accommodationId) { }

	@CacheEvict(cacheNames = RedisCacheConfig.ROOM_DETAIL_CACHE, key = "#p0")
	public void roomChanged(Long roomId) { }
}
