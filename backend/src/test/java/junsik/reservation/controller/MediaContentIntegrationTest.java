package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.CatalogMediaFixture.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.CatalogMediaRepository;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MediaContentIntegrationTest {
	private static final Path ROOT;
	static {
		try { ROOT = Files.createTempDirectory("reservation-media-test-"); }
		catch (IOException exception) { throw new ExceptionInInitializerError(exception); }
	}

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) { registry.add("reservation.media.root", ROOT::toString); }

	@AfterAll
	static void cleanup() throws IOException {
		try (var files = Files.list(ROOT)) {
			for (Path file : files.toList()) { Files.deleteIfExists(file); }
		}
		Files.deleteIfExists(ROOT);
	}

	@Autowired MockMvc mvc;
	@Autowired AccommodationRepository accommodations;
	@Autowired CatalogMediaRepository media;

	@Test
	void servesAnonymousImageOnlyWithMatchingDbRecordAndNoStore() throws Exception {
		CatalogMedia stored = media.saveAndFlush(image(accommodations.saveAndFlush(accommodation()), 0));
		Path file = ROOT.resolve(stored.getStorageKey());
		Files.write(file, png());
		String url = "/api/v1/media/" + stored.getId() + "/content";
		mvc.perform(get(url)).andExpect(status().isOk()).andExpect(content().bytes(png()))
				.andExpect(content().contentType("image/png"))
				.andExpect(header().string("Cache-Control", "no-store"))
				.andExpect(header().string("X-Content-Type-Options", "nosniff"));
		media.delete(stored);
		media.flush();
		mvc.perform(get(url)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MEDIA_001"));
	}

	@Test
	void missingOrTruncatedFilesAndInvalidIdsReturnCommonErrors() throws Exception {
		CatalogMedia stored = media.saveAndFlush(image(accommodations.saveAndFlush(accommodation()), 0));
		String url = "/api/v1/media/" + stored.getId() + "/content";
		mvc.perform(get(url)).andExpect(status().isNotFound());
		Files.write(ROOT.resolve(stored.getStorageKey()), new byte[] {1});
		mvc.perform(get(url)).andExpect(status().isNotFound());
		mvc.perform(get("/api/v1/media/0/content")).andExpect(status().isBadRequest());
		mvc.perform(get("/api/v1/media/invalid/content")).andExpect(status().isBadRequest());
		mvc.perform(post("/api/v1/media")).andExpect(status().isUnauthorized());
	}
}
