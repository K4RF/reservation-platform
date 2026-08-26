package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.entity.Accommodation;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.repository.AccommodationRepository;
import junsik.reservation.security.JwtTokenProvider;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccommodationIntegrationTest {

	private static final String ACCOMMODATIONS_URL = "/api/v1/accommodations";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private AccommodationRepository accommodationRepository;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@Test
	void createsAccommodationWithAdminRole() throws Exception {
		mockMvc.perform(post(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "  Ocean View Hotel  ",
							  "description": "  A hotel overlooking the ocean.  ",
							  "address": "  123 Beach Road  "
							}
							"""))
				.andExpect(status().isCreated())
				.andExpect(header().string(
						"Location",
						org.hamcrest.Matchers.matchesPattern("/api/v1/accommodations/\\d+")
				))
				.andExpect(jsonPath("$.accommodationId").isNumber())
				.andExpect(jsonPath("$.name").value("Ocean View Hotel"))
				.andExpect(jsonPath("$.description").value("A hotel overlooking the ocean."))
				.andExpect(jsonPath("$.address").value("123 Beach Road"))
				.andExpect(jsonPath("$.status").value("ACTIVE"));

		Accommodation saved = accommodationRepository.findAll().getFirst();
		assertThat(saved.getName()).isEqualTo("Ocean View Hotel");
		assertThat(saved.getDescription()).isEqualTo("A hotel overlooking the ocean.");
		assertThat(saved.getAddress()).isEqualTo("123 Beach Road");
		assertThat(saved.getStatus()).isEqualTo(AccommodationStatus.ACTIVE);
	}

	@Test
	void updatesAccommodationInformationWithAdminRole() throws Exception {
		Accommodation accommodation = saveAccommodation(1);

		mockMvc.perform(put(ACCOMMODATIONS_URL + "/{accommodationId}", accommodation.getId())
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "  Updated Hotel  ",
							  "description": "  Updated description  ",
							  "address": "  Updated address  "
							}
							"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.name").value("Updated Hotel"))
				.andExpect(jsonPath("$.description").value("Updated description"))
				.andExpect(jsonPath("$.address").value("Updated address"))
				.andExpect(jsonPath("$.status").value("ACTIVE"));

		assertThat(accommodation.getName()).isEqualTo("Updated Hotel");
	}

	@Test
	void changesAccommodationStatusWithAdminRole() throws Exception {
		Accommodation accommodation = saveAccommodation(1);

		mockMvc.perform(patch(ACCOMMODATIONS_URL + "/{accommodationId}/status", accommodation.getId())
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"status\":\"INACTIVE\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.status").value("INACTIVE"));

		assertThat(accommodation.getStatus()).isEqualTo(AccommodationStatus.INACTIVE);
	}

	@Test
	void rejectsAccommodationManagementFromUserRole() throws Exception {
		Accommodation accommodation = saveAccommodation(1);

		mockMvc.perform(put(ACCOMMODATIONS_URL + "/{accommodationId}", accommodation.getId())
					.header("Authorization", bearerToken(MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content(validCreateRequest()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTH_002"));

		mockMvc.perform(patch(ACCOMMODATIONS_URL + "/{accommodationId}/status", accommodation.getId())
					.header("Authorization", bearerToken(MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"status\":\"INACTIVE\"}"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("AUTH_002"));
	}

	@Test
	void rejectsInvalidAndUnknownAccommodationUpdate() throws Exception {
		Accommodation accommodation = saveAccommodation(1);

		mockMvc.perform(put(ACCOMMODATIONS_URL + "/{accommodationId}", accommodation.getId())
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":\"\",\"description\":\"\",\"address\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "description", "address")));

		mockMvc.perform(put(ACCOMMODATIONS_URL + "/999999")
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content(validCreateRequest()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"));
	}

	@Test
	void rejectsBlankAccommodationFields() throws Exception {
		mockMvc.perform(post(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.ADMIN))
					.contentType(MediaType.APPLICATION_JSON)
					.content("""
							{
							  "name": "",
							  "description": "",
							  "address": ""
							}
							"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[*].field", containsInAnyOrder(
						"name",
						"description",
						"address"
				)));

		assertThat(accommodationRepository.count()).isZero();
	}

	@Test
	void rejectsAccommodationCreationFromUserRole() throws Exception {
		mockMvc.perform(post(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.USER))
					.contentType(MediaType.APPLICATION_JSON)
					.content(validCreateRequest()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.code").value("AUTH_002"))
				.andExpect(jsonPath("$.path").value(ACCOMMODATIONS_URL));

		assertThat(accommodationRepository.count()).isZero();
	}

	@Test
	void getsAccommodationById() throws Exception {
		Accommodation accommodation = saveAccommodation(1);

		mockMvc.perform(get(ACCOMMODATIONS_URL + "/" + accommodation.getId())
					.header("Authorization", bearerToken(MemberRole.USER)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.accommodationId").value(accommodation.getId()))
				.andExpect(jsonPath("$.name").value("Accommodation 1"))
				.andExpect(jsonPath("$.description").value("Description 1"))
				.andExpect(jsonPath("$.address").value("Address 1"));
	}

	@Test
	void returnsNotFoundForUnknownAccommodation() throws Exception {
		mockMvc.perform(get(ACCOMMODATIONS_URL + "/999999")
					.header("Authorization", bearerToken(MemberRole.USER)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.code").value("ACCOMMODATION_001"))
				.andExpect(jsonPath("$.message").value("존재하지 않는 숙소입니다."))
				.andExpect(jsonPath("$.path").value(ACCOMMODATIONS_URL + "/999999"));
	}

	@Test
	void getsAccommodationPageOrderedById() throws Exception {
		for (int index = 1; index <= 5; index++) {
			saveAccommodation(index);
		}

		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("page", "1")
					.param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].name").value("Accommodation 3"))
				.andExpect(jsonPath("$.content[1].name").value("Accommodation 4"))
				.andExpect(jsonPath("$.page").value(1))
				.andExpect(jsonPath("$.size").value(2))
				.andExpect(jsonPath("$.totalElements").value(5))
				.andExpect(jsonPath("$.totalPages").value(3))
				.andExpect(jsonPath("$.first").value(false))
				.andExpect(jsonPath("$.last").value(false));
	}

	@Test
	void searchesAccommodationNameAndAppliesAllowedSort() throws Exception {
		Accommodation cityHotel = saveAccommodation("City HOTEL");
		Accommodation oceanHotel = saveAccommodation("Ocean Hotel");
		saveAccommodation("Mountain Guesthouse");

		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("name", " hotel ")
					.param("sortBy", "NAME")
					.param("direction", "DESC")
					.param("page", "0")
					.param("size", "2"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(2))
				.andExpect(jsonPath("$.content[0].accommodationId").value(oceanHotel.getId()))
				.andExpect(jsonPath("$.content[1].accommodationId").value(cityHotel.getId()))
				.andExpect(jsonPath("$.totalElements").value(2));

		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("name", "not-found"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(0))
				.andExpect(jsonPath("$.totalElements").value(0));
	}

	@Test
	void rejectsUnsupportedAccommodationSortField() throws Exception {
		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("sortBy", "ADDRESS"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void rejectsInvalidPaginationParameters() throws Exception {
		mockMvc.perform(get(ACCOMMODATIONS_URL)
					.header("Authorization", bearerToken(MemberRole.USER))
					.param("page", "-1")
					.param("size", "101"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"));
	}

	private Accommodation saveAccommodation(int index) {
		return accommodationRepository.saveAndFlush(Accommodation.create(
				"Accommodation " + index,
				"Description " + index,
				"Address " + index
		));
	}

	private Accommodation saveAccommodation(String name) {
		return accommodationRepository.saveAndFlush(Accommodation.create(
				name,
				"Description",
				"Address"
		));
	}

	private String bearerToken(MemberRole role) {
		return "Bearer " + jwtTokenProvider.createAccessToken(1L, role);
	}

	private String validCreateRequest() {
		return """
				{
				  "name": "Ocean View Hotel",
				  "description": "A hotel overlooking the ocean.",
				  "address": "123 Beach Road"
				}
				""";
	}
}
