package junsik.reservation.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.Callable;

import jakarta.servlet.http.HttpServletResponse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;

import junsik.reservation.enums.MemberRole;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
		"reservation.observability.enabled=true",
		"reservation.observability.scrape-password=LocalFixtureOnly_NotARealSecret_358",
		"management.server.port=0"
})
@Import(ManagementSecurityIntegrationTest.MetricFixtures.class)
@ExtendWith(OutputCaptureExtension.class)
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
				.doesNotContain(syntheticPath, "LocalFixtureOnly");
	}

	@Test
	void countsAndLabelsTheActualApiResponsesAndKeepsDiagnosticsOutOfTheTimer(CapturedOutput logs) throws Exception {
		String before = scrape();
		String token = "Bearer " + jwtTokens.createAccessToken(1L, MemberRole.USER);
		String email = "metric-private@example.test";
		String signup = "{\"email\":\"" + email + "\",\"password\":\"Synthetic-Private-359\"}";
		assertThat(post("/api/v1/members", signup, null).statusCode()).isEqualTo(201);
		assertThat(post("/api/v1/members", signup, null).statusCode()).isEqualTo(409);
		assertThat(post("/api/v1/members", "{}", null).statusCode()).isEqualTo(400);
		assertThat(post("/api/v1/members", "{not-json", null).statusCode()).isEqualTo(400);
		assertThat(get(apiPort, "/api/v1/reservations", null).statusCode()).isEqualTo(401);
		assertThat(post("/api/v1/accommodations", "{}", token).statusCode()).isEqualTo(403);

		for (long id = 712345000; id < 712345025; id++) {
			assertThat(get(apiPort, "/api/v1/accommodations/" + id + "?keyword=private-query-" + id, null).statusCode()).isEqualTo(404);
			// The existing API advice maps an unmapped resource exception to 500. Do not change that contract here.
			assertThat(get(apiPort, "/api/v1/unmapped-private-" + id, token).statusCode()).isEqualTo(500);
		}
		assertThat(get(apiPort, "/api/v1/metric-fixture/failure", token).statusCode()).isEqualTo(500);

		assertThat(get(managementPort, "/actuator/health/readiness", auth()).statusCode()).isEqualTo(200);
		assertThat(get(managementPort, "/actuator/prometheus", null).statusCode()).isEqualTo(401);
		assertThat(get(apiPort, "/actuator/prometheus", null).statusCode()).isBetween(400, 499);
		String after = scrape();

		assertDelta(before, after, 1, "uri=\"/api/v1/members\"", "method=\"POST\"", "status=\"201\"", "outcome=\"SUCCESS\"", "error_code=\"NONE\"");
		assertDelta(before, after, 1, "uri=\"/api/v1/members\"", "status=\"409\"", "error_code=\"MEMBER_001\"", "outcome=\"EXPECTED_REJECTION\"");
		assertDelta(before, after, 1, "status=\"400\"", "error_code=\"COMMON_001\"");
		assertDelta(before, after, 1, "status=\"400\"", "error_code=\"COMMON_002\"");
		assertDelta(before, after, 1, "uri=\"SECURITY\"", "status=\"401\"", "error_code=\"AUTH_001\"");
		assertDelta(before, after, 1, "uri=\"SECURITY\"", "status=\"403\"", "error_code=\"AUTH_002\"");
		assertDelta(before, after, 25, "uri=\"/api/v1/accommodations/{accommodationId}\"", "status=\"404\"");
		assertDelta(before, after, 25, "uri=\"UNMATCHED\"", "status=\"500\"", "error_code=\"COMMON_003\"");
		assertDelta(before, after, 1, "uri=\"/api/v1/metric-fixture/failure\"", "status=\"500\"", "outcome=\"SERVER_ERROR\"");
		assertDelta(before, after, 57);
		assertThat(after).contains("http_server_requests_seconds_sum", "jvm_threads_live_threads",
						"jvm_memory_used_bytes", "process_cpu_usage")
				.doesNotContain("unmapped-private-", "private-query-", "712345", "Synthetic-Private-359",
						token, email, "fixture-private-exception", "exception=\"", "error=\"", "/actuator/");
		assertThat(logs.getAll()).contains("Unhandled exception type=IllegalStateException")
				.doesNotContain(email, "Synthetic-Private-359", "fixture-private-exception", token);
		String[] created = { "status=\"201\"", "uri=\"/api/v1/members\"" };
		assertThat(series(after, "_bucket", created)).hasSize(9)
				.anyMatch(line -> line.contains("le=\"0.005\"")).anyMatch(line -> line.contains("le=\"3.0\""));
	}

	@Test
	void countsAsyncCompletionAndTimeoutAndContainerErrorDispatchOnlyOnce() throws Exception {
		String token = "Bearer " + jwtTokens.createAccessToken(1L, MemberRole.USER);
		String before = scrape();
		assertThat(get(apiPort, "/api/v1/rooms/metric-fixture-async", null).statusCode()).isEqualTo(200);
		assertThat(get(apiPort, "/api/v1/metric-fixture/error-dispatch", token).statusCode()).isEqualTo(404);
		assertThat(get(apiPort, "/api/v1/rooms/metric-fixture-timeout", null).statusCode()).isEqualTo(500);
		String after = scrape();
		assertDelta(before, after, 1, "uri=\"/api/v1/rooms/metric-fixture-async\"", "status=\"200\"");
		assertDelta(before, after, 1, "uri=\"/api/v1/metric-fixture/error-dispatch\"", "status=\"404\"", "error_code=\"UNCLASSIFIED\"");
		assertDelta(before, after, 1, "uri=\"/api/v1/rooms/metric-fixture-timeout\"", "status=\"500\"");
		assertDelta(before, after, 3);
	}

	private void assertDelta(String before, String after, long count, String... labels) {
		assertThat(counters(after, labels) - counters(before, labels)).as(String.join(",", labels)).isEqualTo(count);
	}

	private List<String> series(String scrape, String suffix, String... labels) {
		return scrape.lines().filter(line -> line.startsWith("http_server_requests_seconds" + suffix + "{"))
				.filter(line -> List.of(labels).stream().allMatch(line::contains)).toList();
	}

	private long counters(String scrape, String... labels) {
		return series(scrape, "_count", labels).stream()
				.mapToLong(line -> (long) Double.parseDouble(line.substring(line.lastIndexOf(' ') + 1))).sum();
	}

	private String scrape() throws Exception {
		var response = get(managementPort, "/actuator/prometheus", auth());
		assertThat(response.statusCode()).isEqualTo(200);
		return response.body();
	}

	private HttpResponse<String> post(String path, String body, String authorization) throws Exception {
		var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + apiPort + path))
				.timeout(Duration.ofSeconds(6)).header("Content-Type", "application/json")
				.POST(HttpRequest.BodyPublishers.ofString(body));
		if (authorization != null) {
			request.header("Authorization", authorization);
		}
		return client.send(request.build(), HttpResponse.BodyHandlers.ofString());
	}

	@RestController
	static class MetricFixtures {

		@GetMapping("/api/v1/rooms/metric-fixture-async")
		Callable<String> async() {
			return () -> "fixture response";
		}

		@GetMapping("/api/v1/rooms/metric-fixture-timeout")
		DeferredResult<String> timeout() {
			return new DeferredResult<>(100L);
		}

		@GetMapping("/api/v1/metric-fixture/error-dispatch")
		void errorDispatch(HttpServletResponse response) throws IOException {
			response.sendError(404);
		}

		@GetMapping("/api/v1/metric-fixture/failure")
		String failure() {
			throw new IllegalStateException("fixture-private-exception");
		}
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
