package junsik.reservation.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.interceptor.CacheErrorHandler;

public class RedisCacheFallbackErrorHandler implements CacheErrorHandler {

	private static final Logger log = LoggerFactory.getLogger(RedisCacheFallbackErrorHandler.class);

	@Override
	public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
		logFailure("get", cache, key, exception);
	}

	@Override
	public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
		logFailure("put", cache, key, exception);
	}

	@Override
	public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
		logFailure("evict", cache, key, exception);
	}

	@Override
	public void handleCacheClearError(RuntimeException exception, Cache cache) {
		logFailure("clear", cache, null, exception);
	}

	private void logFailure(String operation, Cache cache, Object key, RuntimeException exception) {
		log.warn(
				"Redis cache operation failed; continuing without cache. operation={}, cache={}, key={}, cause={}",
				operation,
				cache.getName(),
				key,
				exception.toString()
		);
	}
}
