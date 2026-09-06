package junsik.reservation.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.mysql.MySQLContainer;

@SpringBootTest(properties = "spring.jpa.hibernate.ddl-auto=create")
public abstract class MySqlIntegrationTestSupport {

	protected static final MySQLContainer MYSQL;

	static {
		MYSQL = new MySQLContainer("mysql:8.4");
		MYSQL.start();
	}

	@DynamicPropertySource
	static void configureMySql(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
		registry.add("spring.datasource.username", MYSQL::getUsername);
		registry.add("spring.datasource.password", MYSQL::getPassword);
		registry.add("spring.datasource.driver-class-name", () -> "com.mysql.cj.jdbc.Driver");
	}
}
