package junsik.reservation.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

public abstract class RedisIntegrationTestSupport {

	protected static final GenericContainer<?> REDIS;

	static {
		REDIS = new GenericContainer<>(DockerImageName.parse("redis:7.4"))
				.withExposedPorts(6379);
		REDIS.start();
	}

	@DynamicPropertySource
	static void configureRedis(DynamicPropertyRegistry registry) {
		registry.add("spring.data.redis.host", REDIS::getHost);
		registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
	}
}
