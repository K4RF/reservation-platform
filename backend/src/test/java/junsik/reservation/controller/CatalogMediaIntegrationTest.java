package junsik.reservation.controller;

import static junsik.reservation.support.AccommodationFixture.accommodation;
import static junsik.reservation.support.CatalogMediaFixture.image;
import static junsik.reservation.support.RoomFixture.room;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.accommodation.Accommodation;
import junsik.reservation.entity.media.CatalogMedia;
import junsik.reservation.entity.room.Room;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.repository.CatalogMediaRepository;
import junsik.reservation.repository.RoomRepository;
import junsik.reservation.service.media.CatalogMediaReadService;
import junsik.reservation.service.accommodation.AccommodationService;

@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureMockMvc
@Transactional
class CatalogMediaIntegrationTest {
	@Autowired MockMvc mvc;
	@Autowired AccommodationRepository accommodations;
	@Autowired RoomRepository rooms;
	@Autowired junsik.reservation.repository.RoomInventoryRepository inventories;
	@Autowired CatalogMediaRepository media;
	@Autowired CatalogMediaReadService reads;
	@Autowired AccommodationService accommodationService;
	@Autowired EntityManager entityManager;
	@Autowired EntityManagerFactory entityManagerFactory;

	@Test
	void publicCatalogMapsOwnersAndBoundsGalleryWithStableTieBreaking() throws Exception {
		Accommodation owner = accommodations.saveAndFlush(accommodation());
		Room room = rooms.saveAndFlush(room(owner));
		CatalogMedia first = media.saveAndFlush(image(owner, 0));
		CatalogMedia tied = media.saveAndFlush(image(owner, 0));
		for (int i = 0; i < 23; i++) { media.save(image(owner, i + 1)); }
		CatalogMedia roomImage = media.saveAndFlush(image(room, 0));
		inventories.saveAndFlush(junsik.reservation.support.RoomInventoryFixture.roomInventory(room));
		String path = "/api/v1/accommodations/" + owner.getId();
		mvc.perform(get(path)).andExpect(status().isOk())
				.andExpect(jsonPath("$.representativeImage.mediaId").value(first.getId()))
				.andExpect(jsonPath("$.images.length()").value(20))
				.andExpect(jsonPath("$.images[1].mediaId").value(tied.getId()))
				.andExpect(jsonPath("$.images[0].url").value("/api/v1/media/" + first.getId() + "/content"))
				.andExpect(jsonPath("$.images[0].width").value(1))
				.andExpect(jsonPath("$.images[0].storageKey").doesNotExist())
				.andExpect(jsonPath("$.images[0].rightsRecord").doesNotExist());
		mvc.perform(get("/api/v1/accommodations").param("name", owner.getName()))
				.andExpect(status().isOk()).andExpect(jsonPath("$.content[0].images.length()").value(1));
		mvc.perform(get("/api/v1/rooms/" + room.getId())).andExpect(status().isOk())
				.andExpect(jsonPath("$.representativeImage.mediaId").value(roomImage.getId()))
				.andExpect(jsonPath("$.accommodationId").value(owner.getId()));
		mvc.perform(get(path + "/rooms")).andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].images[0].mediaId").value(roomImage.getId()));
		mvc.perform(get(path + "/rooms/available").param("checkInDate", "2030-01-10")
				.param("checkOutDate", "2030-01-11").param("guestCount", "1"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.content[0].images[0].mediaId").value(roomImage.getId()));

		media.delete(first);
		media.flush();
		mvc.perform(get(path)).andExpect(jsonPath("$.representativeImage.mediaId").value(tied.getId()));
		CatalogMedia promoted = media.findAccommodationImages(List.of(owner.getId()), 20).getLast();
		promoted.changeSortOrder(0);
		tied.changeSortOrder(10);
		media.flush();
		assertThat(reads.accommodationImages(List.of(owner.getId()), 1).get(owner.getId()).getFirst().mediaId())
				.isEqualTo(promoted.getId());
	}

	@Test
	void legacyRowsHaveNoInventedImagesAndOpenApiDescribesMedia() throws Exception {
		Accommodation owner = accommodations.saveAndFlush(accommodation());
		mvc.perform(get("/api/v1/accommodations/" + owner.getId())).andExpect(status().isOk())
				.andExpect(jsonPath("$.images").isEmpty()).andExpect(jsonPath("$.representativeImage").isEmpty());
		mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
				.andExpect(jsonPath("$.components.schemas.MediaResponse.properties.url").exists())
				.andExpect(jsonPath("$.components.schemas.AccommodationResponse.properties.images").exists())
				.andExpect(jsonPath("$.components.schemas.RoomResponse.properties.representativeImage").exists())
				.andExpect(jsonPath("$.paths['/api/v1/media/{mediaId}/content'].get.responses['404'].content['application/json']").exists());
	}

	@Test
	void pageMediaUsesOneQueryRegardlessOfOwnersAndSkipsEmptyPages() {
		Accommodation first = accommodations.saveAndFlush(accommodation());
		Accommodation second = accommodations.saveAndFlush(accommodation());
		Room room = rooms.saveAndFlush(room(first));
		media.saveAllAndFlush(List.of(image(first, 1), image(first, 0), image(second, 0), image(room, 0)));
		entityManager.clear();
		var statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
		statistics.clear();
		var result = reads.accommodationImages(List.of(first.getId(), second.getId()), 1);
		assertThat(result).hasSize(2);
		assertThat(result.values()).allSatisfy(images -> assertThat(images).hasSize(1));
		assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
		reads.accommodationImages(List.of(), 1);
		assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);
	}
}
