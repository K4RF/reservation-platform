package junsik.reservation;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.AuthenticationTestSupport.bearerToken;
import static junsik.reservation.support.MediaUploadFixture.*;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.*;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.cache.CacheManager;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import junsik.reservation.config.RedisCacheConfig;
import junsik.reservation.dto.media.request.MediaMetadataRequest;
import junsik.reservation.entity.media.MediaFileCleanup;
import junsik.reservation.enums.MediaOwnerType;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.global.exception.BusinessException;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.CatalogMediaRepository;
import junsik.reservation.repository.MediaFileCleanupRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;
import junsik.reservation.service.accommodation.AccommodationService;
import junsik.reservation.service.media.*;
import junsik.reservation.service.room.RoomService;
import junsik.reservation.support.MySqlRedisIntegrationTestSupport;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
		"spring.jpa.hibernate.ddl-auto=create", "server.address=127.0.0.1", "reservation.cache.enabled=true", "reservation.media.cleanup-delay=0s",
		"reservation.media.cleanup-scheduling-enabled=true", "reservation.media.cleanup-interval=PT1H",
		"spring.servlet.multipart.max-file-size=10MB", "spring.servlet.multipart.max-request-size=11MB"
})
class MediaManagementMySqlIntegrationTest extends MySqlRedisIntegrationTestSupport {
	private static final Path ROOT;
	static {
		try { ROOT = Files.createTempDirectory("media-mysql-http-test-"); }
		catch (java.io.IOException exception) { throw new ExceptionInInitializerError(exception); }
	}
	@DynamicPropertySource static void properties(DynamicPropertyRegistry registry) { registry.add("reservation.media.root", ROOT::toString); }
	@AfterAll static void cleanupFiles() throws Exception {
		try (var files = Files.list(ROOT)) { for (Path file : files.toList()) { Files.delete(file); } }
		Files.delete(ROOT);
	}
	@LocalServerPort int port;
	@Autowired AccommodationRepository accommodations;
	@Autowired RoomRepository rooms;
	@Autowired AccommodationService accommodationService;
	@Autowired RoomService roomService;
	@Autowired MediaManagementService management;
	@Autowired MediaUploadCoordinator uploads;
	@Autowired MediaFileCleanupService cleanup;
	@Autowired MediaFileReservation reservations;
	@Autowired MediaFileCleanupRepository tasks;
	@Autowired CatalogMediaRepository media;
	@Autowired LocalMediaStorage storage;
	@Autowired CacheManager caches;
	@Autowired JwtTokenProvider tokens;
	@Autowired ObjectMapper mapper;
	@Autowired PlatformTransactionManager transactions;
	@Autowired JdbcTemplate jdbc;
	@Autowired org.springframework.context.ApplicationContext context;

	@BeforeEach void clearCaches() {
		caches.getCache(RedisCacheConfig.ACCOMMODATION_DETAIL_CACHE).clear();
		caches.getCache(RedisCacheConfig.ROOM_DETAIL_CACHE).clear();
	}

	@Test
	void realHttpUploadPublicReadsAndWritesEvictRedisSnapshots() throws Exception {
		var owner = accommodations.saveAndFlush(accommodation());
		var room = rooms.saveAndFlush(room(owner));
		String base = "/api/v1/accommodations/" + owner.getId() + "/media";
		assertThat(accommodationService.getById(owner.getId()).images()).isEmpty(); // Warm empty Redis snapshot.
		var before = send("GET", base, null, null);
		var created = sendUpload("POST", base, etag(before));
		assertThat(created.statusCode()).isEqualTo(201);
		long id = mapper.readTree(created.body()).path("images").get(0).path("image").path("mediaId").longValue();
		assertThat(accommodationService.getById(owner.getId()).representativeImage().mediaId()).isEqualTo(id);
		var content = send("GET", "/api/v1/media/" + id + "/content", null, null);
		assertThat(content.statusCode()).isEqualTo(200);
		assertThat(content.headers().firstValue("content-type")).contains("image/png");
		var edited = send("PUT", base + "/" + id, etag(created), "{\"altText\":\"새 대체 텍스트\",\"source\":\"Generated pixels\",\"rightsRecord\":\"isolated test\"}");
		assertThat(edited.statusCode()).isEqualTo(200);
		assertThat(accommodationService.getById(owner.getId()).representativeImage().altText()).isEqualTo("새 대체 텍스트");
		var replaced = sendUpload("PUT", base + "/" + id + "/content", etag(edited));
		assertThat(replaced.statusCode()).isEqualTo(200);
		long next = mapper.readTree(replaced.body()).path("images").get(0).path("image").path("mediaId").longValue();
		assertThat(next).isNotEqualTo(id);
		assertThat(accommodationService.getById(owner.getId()).representativeImage().mediaId()).isEqualTo(next);
		assertThat(send("GET", "/api/v1/media/" + id + "/content", null, null).statusCode()).isEqualTo(404);
		assertThat(send("DELETE", base + "/" + next, etag(replaced), null).statusCode()).isEqualTo(200);
		assertThat(accommodationService.getById(owner.getId()).images()).isEmpty();
		assertThat(roomService.getById(room.getId()).images()).isEmpty();
		String roomBase = "/api/v1/rooms/" + room.getId() + "/media";
		var roomCreated = sendUpload("POST", roomBase, etag(send("GET", roomBase, null, null)));
		assertThat(roomCreated.statusCode()).isEqualTo(201);
		assertThat(roomService.getById(room.getId()).images()).hasSize(1);
		cleanup.processDue();
	}

	@Test
	void concurrentRepresentativeUpdatesWithOneRevisionHaveOneWinner() throws Exception {
		var owner = accommodations.saveAndFlush(accommodation());
		for (int i = 0; i < 3; i++) {
			uploads.upload(MediaOwnerType.ACCOMMODATION, owner.getId(), quote(management.get(MediaOwnerType.ACCOMMODATION, owner.getId()).revision()),
					file(), new MediaMetadataRequest("pixel " + i, "Generated fixture", "test only"), null);
		}
		var album = management.get(MediaOwnerType.ACCOMMODATION, owner.getId());
		CountDownLatch start = new CountDownLatch(1);
		try (var executor = Executors.newFixedThreadPool(2)) {
			var futures = List.of(album.images().get(1), album.images().get(2)).stream().map(item -> executor.submit(() -> {
				start.await();
				try {
					management.representative(MediaOwnerType.ACCOMMODATION, owner.getId(), item.image().mediaId(), quote(album.revision()));
					return "OK";
				} catch (BusinessException exception) { return exception.getErrorCode().getCode(); }
			})).toList();
			start.countDown();
			assertThat(List.of(futures.get(0).get(10, TimeUnit.SECONDS), futures.get(1).get(10, TimeUnit.SECONDS)))
					.containsExactlyInAnyOrder("OK", "MEDIA_005");
		}
		var after = management.get(MediaOwnerType.ACCOMMODATION, owner.getId());
		assertThat(after.images()).extracting(item -> item.image().sortOrder()).containsExactly(0, 1, 2);
		assertThat(accommodationService.getById(owner.getId()).representativeImage().mediaId())
				.isEqualTo(after.images().getFirst().image().mediaId());
	}

	@Test
	void cleanerWaitsForUncommittedUploadIntentAndNeverDeletesCommittedReference() throws Exception {
		String key = UUID.randomUUID() + ".png";
		reservations.reserve(key);
		var owner = accommodations.saveAndFlush(accommodation());
		var transaction = new TransactionTemplate(transactions);
		CountDownLatch locked = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		try (var executor = Executors.newFixedThreadPool(2)) {
			var writer = executor.submit(() -> transaction.executeWithoutResult(status -> {
				var intent = tasks.lockByKey(key).orElseThrow();
				try { storage.write(key, png()); }
				catch (java.io.IOException failure) { throw new IllegalStateException(failure); }
				locked.countDown();
				try { if (!release.await(5, TimeUnit.SECONDS)) { throw new IllegalStateException("test latch timeout"); } }
				catch (InterruptedException failure) { Thread.currentThread().interrupt(); throw new IllegalStateException(failure); }
				media.saveAndFlush(junsik.reservation.entity.media.CatalogMedia.forAccommodation(owner, key,
						junsik.reservation.enums.MediaFormat.PNG, "pixel", 3, 2, png().length, 0, "generated", "test only"));
				tasks.delete(intent);
			}));
			assertThat(locked.await(5, TimeUnit.SECONDS)).isTrue();
			var cleaner = executor.submit(() -> cleanup.processDue());
			try { assertThatThrownBy(() -> cleaner.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(java.util.concurrent.TimeoutException.class); }
			finally { release.countDown(); }
			writer.get(10, TimeUnit.SECONDS);
			cleaner.get(10, TimeUnit.SECONDS);
		}
		assertThat(Files.exists(ROOT.resolve(key))).isTrue();
		tasks.saveAndFlush(new MediaFileCleanup(key, Instant.EPOCH)); // Ambiguous prior claim: DB reference must win.
		cleanup.processDue();
		assertThat(Files.exists(ROOT.resolve(key))).isTrue();
		assertThat(tasks.existsById(key)).isFalse();
	}

	@Test
	void cleanupSchedulerIsIndependentAndUpgradeSqlAndServletLimitAreValid() throws Exception {
		assertThat(context.getBeansOfType(junsik.reservation.config.MediaCleanupSchedulingConfig.class)).hasSize(1);
		assertThat(context.getBeansOfType(junsik.reservation.service.reservation.ReservationOutboxPublishingScheduler.class)).isEmpty();
		String sql = Files.readString(Path.of("../docs/erd/mysql-media-file-cleanup-upgrade.sql"))
				.replace("media_file_cleanup", "media_file_cleanup_upgradecheck")
				.replace("chk_media_cleanup_attempts", "chk_media_cleanup_upgradecheck_attempts");
		try {
			jdbc.execute(sql);
			assertThat(jdbc.queryForObject("select count(*) from information_schema.table_constraints where table_schema=database() and table_name='media_file_cleanup_upgradecheck' and constraint_type='CHECK'", Integer.class)).isEqualTo(1);
		} finally { jdbc.execute("drop table if exists media_file_cleanup_upgradecheck"); }
		var owner = accommodations.saveAndFlush(accommodation());
		String base = "/api/v1/accommodations/" + owner.getId() + "/media";
		var result = sendUpload("POST", base, etag(send("GET", base, null, null)), new byte[10 * 1024 * 1024 + 1]);
		assertThat(result.statusCode()).isEqualTo(400);
		assertThat(mapper.readTree(result.body()).path("code").toString()).isEqualTo("\"MEDIA_003\"");
	}

	private static String quote(String revision) { return "\"" + revision + "\""; }
	private static String etag(HttpResponse<byte[]> response) { return response.headers().firstValue("ETag").orElseThrow(); }
	private HttpResponse<byte[]> send(String method, String path, String etag, String json) throws Exception {
		var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
				.header("Authorization", bearerToken(tokens, MemberRole.ADMIN));
		if (etag != null) { request.header("If-Match", etag); }
		if (json != null) { request.header("Content-Type", "application/json"); }
		try (var client = HttpClient.newHttpClient()) {
			return client.send(request.method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json)).build(), HttpResponse.BodyHandlers.ofByteArray());
		}
	}
	private HttpResponse<byte[]> sendUpload(String method, String path, String etag) throws Exception {
		return sendUpload(method, path, etag, png());
	}
	private HttpResponse<byte[]> sendUpload(String method, String path, String etag, byte[] bytes) throws Exception {
		String boundary = "test-" + UUID.randomUUID();
		var body = new ByteArrayOutputStream();
		body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"metadata\"\r\nContent-Type: application/json\r\n\r\n").getBytes(StandardCharsets.UTF_8));
		body.write(metadata().getBytes());
		body.write(("\r\n--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"fixture.png\"\r\nContent-Type: image/png\r\n\r\n").getBytes(StandardCharsets.UTF_8));
		body.write(bytes);
		body.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
		var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
				.header("Authorization", bearerToken(tokens, MemberRole.ADMIN)).header("If-Match", etag)
				.header("Content-Type", "multipart/form-data; boundary=" + boundary)
				.method(method, HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
		try (var client = HttpClient.newHttpClient()) { return client.send(request, HttpResponse.BodyHandlers.ofByteArray()); }
	}
}
