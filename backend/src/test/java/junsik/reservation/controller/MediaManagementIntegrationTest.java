package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.AuthenticationTestSupport.bearerToken;
import static junsik.reservation.support.MediaUploadFixture.*;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.CatalogMediaRepository;
import junsik.reservation.repository.MediaFileCleanupRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.security.JwtTokenProvider;
import junsik.reservation.service.media.LocalMediaStorage;
import junsik.reservation.service.media.MediaFileCleanupService;
import junsik.reservation.service.media.MediaFileReservation;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:media-management;MODE=MySQL;DB_CLOSE_DELAY=-1", "reservation.media.cleanup-delay=0s"})
@AutoConfigureMockMvc
class MediaManagementIntegrationTest {
	private static final Path ROOT;
	static {
		try { ROOT = Files.createTempDirectory("media-management-test-"); }
		catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
	}
	@DynamicPropertySource static void storage(DynamicPropertyRegistry registry) { registry.add("reservation.media.root", ROOT::toString); }
	@AfterAll static void cleanupFiles() throws IOException {
		try (var files = Files.list(ROOT)) { for (Path file : files.toList()) { Files.delete(file); } }
		Files.delete(ROOT);
	}

	@Autowired MockMvc mvc;
	@Autowired ObjectMapper mapper;
	@Autowired AccommodationRepository accommodations;
	@Autowired RoomRepository rooms;
	@Autowired JwtTokenProvider tokens;
	@Autowired MediaFileCleanupRepository tasks;
	@Autowired MediaFileCleanupService cleanup;
	@Autowired MediaFileReservation reservations;
	@MockitoSpyBean CatalogMediaRepository media;
	@MockitoSpyBean LocalMediaStorage storage;

	private String admin() { return bearerToken(tokens, MemberRole.ADMIN); }
	private String base() { return "/api/v1/accommodations/" + accommodations.saveAndFlush(accommodation()).getId() + "/media"; }
	private String tag(String base) throws Exception { return mvc.perform(get(base).header("Authorization", admin()))
			.andExpect(status().isOk()).andReturn().getResponse().getHeader("ETag"); }
	private MvcResult upload(String base, String tag) throws Exception {
		return mvc.perform(multipart(base).file(file()).file(metadata()).header("Authorization", admin()).header("If-Match", tag))
				.andExpect(status().isCreated()).andReturn();
	}
	private long id(MvcResult result, int index) throws Exception {
		return mapper.readTree(result.getResponse().getContentAsString()).path("images").get(index).path("image").path("mediaId").longValue();
	}
	private String etag(MvcResult result) { return result.getResponse().getHeader("ETag"); }

	@Test
	void managesUploadMetadataRepresentativeOrderReplacementAndDeletion() throws Exception {
		String base = base();
		MvcResult first = upload(base, tag(base));
		long firstId = id(first, 0);
		MvcResult second = upload(base, etag(first));
		long secondId = id(second, 1);
		mvc.perform(get("/api/v1/media/" + firstId + "/content")).andExpect(status().isOk()).andExpect(content().contentType("image/png"));
		MvcResult promoted = mvc.perform(patch(base + "/" + secondId + "/representative").header("Authorization", admin()).header("If-Match", etag(second)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.images[0].image.mediaId").value(secondId)).andReturn();
		MvcResult ordered = mvc.perform(put(base + "/order").header("Authorization", admin()).header("If-Match", etag(promoted))
				.contentType(MediaType.APPLICATION_JSON).content("{\"mediaIds\":[" + firstId + "," + secondId + "]}"))
				.andExpect(status().isOk()).andReturn();
		MvcResult edited = mvc.perform(put(base + "/" + firstId).header("Authorization", admin()).header("If-Match", etag(ordered))
				.contentType(MediaType.APPLICATION_JSON).content("{\"altText\":\"새 설명\",\"source\":\"test pixel\",\"rightsRecord\":\"test only\"}"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.images[0].image.altText").value("새 설명")).andReturn();
		MvcResult replaced = mvc.perform(multipart(base + "/" + firstId + "/content").file(file()).file(metadata())
				.with(request -> { request.setMethod("PUT"); return request; }).header("Authorization", admin()).header("If-Match", etag(edited)))
				.andExpect(status().isOk()).andReturn();
		long newId = id(replaced, 0);
		assertThat(newId).isNotEqualTo(firstId);
		mvc.perform(get("/api/v1/media/" + firstId + "/content")).andExpect(status().isNotFound());
		MvcResult removed = mvc.perform(delete(base + "/" + newId).header("Authorization", admin()).header("If-Match", etag(replaced)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.images[0].image.mediaId").value(secondId)).andReturn();
		mvc.perform(delete(base + "/" + secondId).header("Authorization", admin()).header("If-Match", etag(removed)))
				.andExpect(status().isOk()).andExpect(jsonPath("$.images").isEmpty());
		cleanup.processDue();
		assertThat(media.existsById(newId)).isFalse();
	}

	@Test
	void validatesAdminOwnershipRevisionAndCompleteOrderWithoutReplay() throws Exception {
		String base = base();
		mvc.perform(get(base)).andExpect(status().isUnauthorized());
		mvc.perform(get(base).header("Authorization", bearerToken(tokens, MemberRole.USER))).andExpect(status().isForbidden());
		mvc.perform(multipart(base).file(file()).file(metadata())).andExpect(status().isUnauthorized());
		mvc.perform(multipart(base).file(file()).file(metadata()).header("Authorization", bearerToken(tokens, MemberRole.USER)))
				.andExpect(status().isForbidden());
		String initial = tag(base);
		MvcResult uploaded = upload(base, initial);
		mvc.perform(multipart(base).file(file()).file(metadata()).header("Authorization", admin()).header("If-Match", initial))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDIA_005"));
		mvc.perform(put(base + "/order").header("Authorization", admin()).header("If-Match", etag(uploaded))
				.contentType(MediaType.APPLICATION_JSON).content("{\"mediaIds\":[]}"))
				.andExpect(status().isBadRequest());
		mvc.perform(delete(base + "/" + id(uploaded, 0)).header("Authorization", admin()))
				.andExpect(status().isBadRequest());
		String other = base();
		mvc.perform(delete(other + "/" + id(uploaded, 0)).header("Authorization", admin()).header("If-Match", tag(other)))
				.andExpect(status().isNotFound());
		mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/accommodations/{ownerId}/media'].post.security[0].bearerAuth").exists())
				.andExpect(jsonPath("$.paths['/api/v1/accommodations/{ownerId}/media'].post.responses['201'].content['application/json']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/accommodations/{ownerId}/media'].post.requestBody.content['multipart/form-data'].encoding.metadata.contentType").value("application/json"))
				.andExpect(jsonPath("$.paths['/api/v1/rooms/{ownerId}/media/{mediaId}/representative'].patch.responses['409'].content['application/json']").exists());
	}

	@Test
	void roomImagesRemainSeparateAndInputsAreValidated() throws Exception {
		var owner = accommodations.saveAndFlush(accommodation());
		var room = rooms.saveAndFlush(room(owner));
		String base = "/api/v1/rooms/" + room.getId() + "/media";
		MvcResult result = upload(base, tag(base));
		mvc.perform(get("/api/v1/rooms/" + room.getId())).andExpect(status().isOk())
				.andExpect(jsonPath("$.representativeImage.mediaId").value(id(result, 0)));
		mvc.perform(get("/api/v1/accommodations/" + owner.getId())).andExpect(jsonPath("$.images").isEmpty());
		mvc.perform(multipart(base).file(new MockMultipartFile("file", "fake.png", "image/png", "bad".getBytes())).file(metadata())
				.header("Authorization", admin()).header("If-Match", etag(result)))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("MEDIA_003"));
		mvc.perform(multipart(base).file(file()).file(new MockMultipartFile("metadata", "", "application/json", "{}".getBytes()))
				.header("Authorization", admin()).header("If-Match", etag(result)))
				.andExpect(status().isBadRequest());
		mvc.perform(multipart(base).file(metadata()).header("Authorization", admin()).header("If-Match", etag(result)))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_002"));
		mvc.perform(multipart(base).file(file()).file(new MockMultipartFile("metadata", "", "text/plain", "{}".getBytes()))
				.header("Authorization", admin()).header("If-Match", etag(result)))
				.andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("COMMON_002"));
	}

	@Test
	void boundsImageCountAtTwenty() throws Exception {
		String base = base();
		String tag = tag(base);
		for (int i = 0; i < 20; i++) { tag = etag(upload(base, tag)); }
		mvc.perform(multipart(base).file(file()).file(metadata()).header("Authorization", admin()).header("If-Match", tag))
				.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEDIA_004"));
	}

	@Test
	void rollsBackDatabaseOnStorageFailureAndCleansFileOnDatabaseFailure() throws Exception {
		String base = base();
		String initial = tag(base);
		doThrow(new IOException("injected write failure")).when(storage).write(anyString(), any(byte[].class));
		mvc.perform(multipart(base).file(file()).file(metadata()).header("Authorization", admin()).header("If-Match", initial))
				.andExpect(status().isServiceUnavailable());
		assertThat(tag(base)).isEqualTo(initial);
		reset(storage);
		doThrow(new org.springframework.dao.DataIntegrityViolationException("injected DB failure")).when(media).saveAndFlush(any(CatalogMedia.class));
		long filesBefore;
		try (var files = Files.list(ROOT)) { filesBefore = files.count(); }
		mvc.perform(multipart(base).file(file()).file(metadata()).header("Authorization", admin()).header("If-Match", initial))
				.andExpect(status().isInternalServerError());
		try (var files = Files.list(ROOT)) { assertThat(files.count()).isEqualTo(filesBefore); }
		assertThat(tag(base)).isEqualTo(initial);
	}

	@Test
	void durableIntentsRecoverCrashOrphansAndRetainFailedDeletionForRetry() throws Exception {
		String key = UUID.randomUUID() + ".png";
		reservations.reserve(key);
		storage.write(key, png()); // Simulate process death before the Media transaction commits.
		doThrow(new IOException("injected deletion failure")).when(storage).delete(key);
		cleanup.processDue();
		assertThat(tasks.findById(key).orElseThrow().getAttempts()).isEqualTo(1);
		assertThat(Files.exists(ROOT.resolve(key))).isTrue();
		reset(storage);
		cleanup.processDue();
		assertThat(tasks.existsById(key)).isFalse();
		assertThat(Files.exists(ROOT.resolve(key))).isFalse();
		mvc.perform(post("/api/v1/admin/media/cleanup").header("Authorization", admin()).contentType(MediaType.APPLICATION_JSON)
				.content("{\"acknowledged\":false}")).andExpect(status().isBadRequest());
		mvc.perform(post("/api/v1/admin/media/cleanup").contentType(MediaType.APPLICATION_JSON).content("{\"acknowledged\":true}"))
				.andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/admin/media/cleanup").header("Authorization", bearerToken(tokens, MemberRole.USER))
				.contentType(MediaType.APPLICATION_JSON).content("{\"acknowledged\":true}"))
				.andExpect(status().isForbidden());
	}

	@Test
	void failedReplacementPreservesOriginalAndDeleteCommitSurvivesPhysicalCleanupFailure() throws Exception {
		String base = base();
		MvcResult original = upload(base, tag(base));
		long id = id(original, 0);
		String oldKey = media.findById(id).orElseThrow().getStorageKey();
		doThrow(new IOException("injected replacement failure")).when(storage).write(anyString(), any(byte[].class));
		mvc.perform(multipart(base + "/" + id + "/content").file(file()).file(metadata())
				.with(request -> { request.setMethod("PUT"); return request; }).header("Authorization", admin()).header("If-Match", etag(original)))
				.andExpect(status().isServiceUnavailable());
		assertThat(tag(base)).isEqualTo(etag(original));
		mvc.perform(get("/api/v1/media/" + id + "/content")).andExpect(status().isOk());
		reset(storage);
		doThrow(new IOException("injected cleanup failure")).when(storage).delete(oldKey);
		mvc.perform(delete(base + "/" + id).header("Authorization", admin()).header("If-Match", etag(original)))
				.andExpect(status().isOk());
		mvc.perform(get("/api/v1/media/" + id + "/content")).andExpect(status().isNotFound());
		cleanup.processDue();
		assertThat(tasks.existsById(oldKey)).isTrue();
		assertThat(Files.exists(ROOT.resolve(oldKey))).isTrue();
		reset(storage);
		cleanup.processDue();
		assertThat(Files.exists(ROOT.resolve(oldKey))).isFalse();
	}
}
