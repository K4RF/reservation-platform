package junsik.reservation.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(ReservationLockProperties.class)
public class RedissonConfig {

	@Bean(destroyMethod = "shutdown")
	RedissonClient redissonClient(
			@Value("${spring.data.redis.host}") String host,
			@Value("${spring.data.redis.port}") int port,
			ReservationLockProperties properties
	) {
		Config config = new Config();
		config.setLockWatchdogTimeout(properties.watchdogTimeout().toMillis());
		config.useSingleServer().setAddress("redis://" + host + ":" + port);
		return Redisson.create(config);
	}
}
