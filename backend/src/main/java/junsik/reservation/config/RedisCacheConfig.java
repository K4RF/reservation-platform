package junsik.reservation.config;

import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;

import junsik.reservation.dto.accommodation.response.AccommodationResponse;
import junsik.reservation.dto.room.response.RoomResponse;
import tools.jackson.databind.ObjectMapper;

@EnableCaching
@Configuration
@ConditionalOnProperty(
		name = "reservation.cache.enabled",
		havingValue = "true",
		matchIfMissing = true
)
@EnableConfigurationProperties(ReservationCacheProperties.class)
public class RedisCacheConfig {

	public static final String ACCOMMODATION_DETAIL_CACHE = "accommodation-detail";
	public static final String ROOM_DETAIL_CACHE = "room-detail";
	public static final String KEY_PREFIX = "reservation:cache:";

	@Bean
	CacheManager cacheManager(
			RedisConnectionFactory connectionFactory,
			ObjectMapper objectMapper,
			ReservationCacheProperties properties
	) {
		RedisCacheConfiguration defaults = RedisCacheConfiguration.defaultCacheConfig()
				.disableCachingNullValues()
				.computePrefixWith(cacheName -> KEY_PREFIX + cacheName + "::")
				.entryTtl(properties.detailTtl());
		Map<String, RedisCacheConfiguration> cacheConfigurations = Map.of(
				ACCOMMODATION_DETAIL_CACHE,
				withJsonValue(defaults, objectMapper, AccommodationResponse.class),
				ROOM_DETAIL_CACHE,
				withJsonValue(defaults, objectMapper, RoomResponse.class)
		);

		return RedisCacheManager.builder(connectionFactory)
				.cacheDefaults(defaults)
				.withInitialCacheConfigurations(cacheConfigurations)
				.disableCreateOnMissingCache()
				.transactionAware()
				.build();
	}

	private <T> RedisCacheConfiguration withJsonValue(
			RedisCacheConfiguration configuration,
			ObjectMapper objectMapper,
			Class<T> valueType
	) {
		JacksonJsonRedisSerializer<T> serializer = new JacksonJsonRedisSerializer<>(
				objectMapper,
				valueType
		);
		return configuration.serializeValuesWith(SerializationPair.fromSerializer(serializer));
	}
}
