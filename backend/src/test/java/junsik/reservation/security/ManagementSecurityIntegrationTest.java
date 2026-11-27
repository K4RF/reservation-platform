package junsik.reservation.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import junsik.reservation.enums.MemberRole;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
		"reservation.observability.enabled=true",
		"reservation.observability.scrape-password=LocalFixtureOnly_NotARealSecret_358",
		"management.server.port=0"
})
class ManagementSecurityIntegrationTest {

	private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

	@LocalServerPort
	private int apiPort;

	@Value("${local.management.port}")
	private int managementPort;

	@Autowired
	private JwtTokenProvider jwtTokens;

	@Test
	void onlyDedicatedCredentialsCanReadOnTheSeparateListener() throws Exception {
		assertThat(managementPort).isPositive().isNotEqualTo(apiPort);
		assertThat(get(managementPort, "/actuator/prometheus", null).statusCode()).isEqualTo(401);
		assertThat(get(managementPort, "/actuator/prometheus", basic("wrong")).statusCode()).isEqualTo(401);
		for (MemberRole role : List.of(MemberRole.USER, MemberRole.ADMIN)) {
			assertThat(get(managementPort, "/actuator/prometheus", "Bearer " + jwtTokens.createAccessToken(1L, role))
					.statusCode()).isEqualTo(401);
		}
		assertThat(get(apiPort, "/actuator/prometheus", auth()).statusCode()).isBetween(400, 499);
		assertThat(get(apiPort, "/api/v1/reservations", auth()).statusCode()).isEqualTo(401);
		assertThat(get(apiPort, "/api/v1/accommodations", null).statusCode()).isEqualTo(200);
		assertThat(get(managementPort, "/api/v1/accommodations", auth()).statusCode()).isBetween(400, 499);
	}

	@Test
	void exposesOnlyMinimalHealthAndBoundedMetricsAndDeniesWrites() throws Exception {
		for (String path : List.of("/health", "/health/liveness", "/health/readiness")) {
			var result = get(managementPort, "/actuator" + path + "?showDetails=true", auth());
			assertThat(result.statusCode()).isEqualTo(200);
			assertThat(result.body()).contains("\"status\":\"UP\"").doesNotContain("components", "details", "jdbc:");
		}
		for (String path : List.of("", "/env", "/configprops", "/heapdump", "/logfile", "/shutdown", "/health/db", "/metrics")) {
			assertThat(get(managementPort, "/actuator" + path, auth()).statusCode()).isBetween(400, 499);
		}
		assertThat(send(managementPort, "/actuator/prometheus", "POST", auth()).statusCode()).isBetween(400, 499);
		String syntheticPath = "/api/v1/test/should-not-be-a-metric-label";
		get(apiPort, syntheticPath, "Bearer " + jwtTokens.createAccessToken(1L, MemberRole.USER));
		var scrape = get(managementPort, "/actuator/prometheus", auth());
		assertThat(scrape.statusCode()).isEqualTo(200);
		assertThat(scrape.body()).contains("jvm_memory_used_bytes", "process_uptime_seconds", "http_server_requests_seconds_count")
				.doesNotContain(syntheticPath, "http_server_requests_seconds_bucket", "LocalFixtureOnly");
	}

	private HttpResponse<String> get(int port, String path, String authorization) throws Exception {
		return send(port, path, "GET", authorization);
	}

	private HttpResponse<String> send(int port, String path, String method, String authorization) throws Exception {
		var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
				.method(method, HttpRequest.BodyPublishers.noBody()).timeout(Duration.ofSeconds(6));
		if (authorization != null) {
			request.header("Authorization", authorization);
		}
		return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
	}

	private String auth() {
		return basic("LocalFixtureOnly_NotARealSecret_358");
	}

	private String basic(String password) {
		return "Basic " + Base64.getEncoder().encodeToString(("reservation-scraper:" + password).getBytes(StandardCharsets.UTF_8));
	}
}
