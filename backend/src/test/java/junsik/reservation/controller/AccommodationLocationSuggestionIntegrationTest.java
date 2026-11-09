package junsik.reservation.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.jayway.jsonpath.JsonPath;
import junsik.reservation.enums.MemberRole;
import junsik.reservation.repository.AccommodationLocationSuggestionRepository.Candidate;
import junsik.reservation.security.JwtTokenProvider;
import junsik.reservation.support.MySqlIntegrationTestSupport;

@AutoConfigureMockMvc
@Transactional
class AccommodationLocationSuggestionIntegrationTest extends MySqlIntegrationTestSupport {

	private static final Logger log = LoggerFactory.getLogger(AccommodationLocationSuggestionIntegrationTest.class);
	private static final String CATALOG_URL = "/api/v1/accommodations";
	private static final String SUGGESTIONS_URL = CATALOG_URL + "/locations/suggestions";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private JwtTokenProvider jwtTokenProvider;

	@MockitoSpyBean
	private NamedParameterJdbcTemplate namedJdbc;

	@Test
	void returnsTheActiveCityAndItsRealChildRegionsWithoutDuplicatesOrAddressInference() throws Exception {
		insert("Hotel A", "대한민국", "서울특별시", "강남구", "ACTIVE");
		insert("Hotel B", "대한민국", "서울특별시", "강남구", "ACTIVE");
		insert("Hotel C", "대한민국", "서울특별시", "마포구", "ACTIVE");
		insert("Hidden hotel", "대한민국", "서울특별시", "송파구", "INACTIVE");
		insert("Partial row", "대한민국", "서울특별시", null, "ACTIVE");
		insert("Legacy row", null, null, null, "ACTIVE");
		insert("No country", null, "서울외곽", "서초구", "ACTIVE");

		mockMvc.perform(get(SUGGESTIONS_URL).param("q", " \t서울\u00a0 "))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3))
				.andExpect(jsonPath("$[0].type").value("CITY"))
				.andExpect(jsonPath("$[0].displayName").value("서울특별시"))
				.andExpect(jsonPath("$[0].searchParams.region").doesNotExist())
				.andExpect(jsonPath("$[1].type").value("REGION"))
				.andExpect(jsonPath("$[1].displayName").value("강남구"))
				.andExpect(jsonPath("$[2].displayName").value("마포구"));

		mockMvc.perform(get(SUGGESTIONS_URL).param("q", "강남\u00a0   서울"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].searchParams.region").value("강남구"));
	}

	@Test
	void ranksExactThenPrefixThenSubstringAndTreatsLikeCharactersLiterally() throws Exception {
		insert("Contains", "KR", "New Alpha", "West", "ACTIVE");
		insert("Prefix", "KR", "Alphaville", "West", "ACTIVE");
		insert("Exact", "KR", "Alpha", "West", "ACTIVE");
		insert("Literal", "KR", "A%_!\\town", "East", "ACTIVE");

		mockMvc.perform(get(SUGGESTIONS_URL).param("q", " \t aLpHa\u2003"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[*].searchParams.city", contains(
						"Alpha", "Alphaville", "Alpha", "Alphaville", "New Alpha", "New Alpha")))
				.andExpect(jsonPath("$[*].type", contains("CITY", "CITY", "REGION", "REGION", "CITY", "REGION")));
		mockMvc.perform(get(SUGGESTIONS_URL).param("q", "%_!\\"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].searchParams.city").value("A%_!\\town"));
	}

	@Test
	void appliesCityAndRegionSearchParamsAsIsAndDisambiguatesByCountryAndParentCity() throws Exception {
		insert("KR hotel", "KR", "Seoul", "Central", "ACTIVE");
		insert("Other country", "US", "Seoul", "Central", "ACTIVE");
		insert("Other city", "KR", "Busan", "Central", "ACTIVE");
		insert("Partial row", "KR", "Seoul", null, "ACTIVE");
		insert("Other district", "KR", "Seoul", "South", "ACTIVE");
		insert("Inactive hotel", "KR", "Seoul", "Central", "INACTIVE");

		String suggestions = mockMvc.perform(get(SUGGESTIONS_URL).param("q", "seoul"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[*].searchParams.country", contains("KR", "US", "KR", "KR", "US")))
				.andReturn().getResponse().getContentAsString();
		Map<String, String> city = JsonPath.read(suggestions, "$[0].searchParams");
		mockMvc.perform(search(city))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[*].name", contains("KR hotel", "Partial row", "Other district")));

		String regions = mockMvc.perform(get(SUGGESTIONS_URL).param("q", "Central"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[*].searchParams.city", contains("Busan", "Seoul", "Seoul")))
				.andReturn().getResponse().getContentAsString();
		List<Map<String, String>> params = JsonPath.read(regions, "$[*].searchParams");
		List<String> expected = List.of("Other city", "KR hotel", "Other country");
		for (int i = 0; i < params.size(); i++) {
			mockMvc.perform(search(params.get(i)))
					.andExpect(status().isOk())
					.andExpect(jsonPath("$.content[*].name", contains(expected.get(i))));
		}
		mockMvc.perform(get(CATALOG_URL).param("city", "Seoul").param("region", "Central").param("status", "ACTIVE"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[*].name", contains("KR hotel", "Other country", "Partial row")));
	}

	@Test
	void limitsTheSingleProjectionQueryAtTheDatabaseAndRecordsItsMySqlPlan() throws Exception {
		for (int i = 14; i >= 0; i--) {
			insert("Hotel " + i, "KR", "Limit City", "District %02d".formatted(i), "ACTIVE");
		}
		clearInvocations(namedJdbc);
		mockMvc.perform(get(SUGGESTIONS_URL).param("q", "District"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(10))
				.andExpect(jsonPath("$[0].displayName").value("District 00"))
				.andExpect(jsonPath("$[9].displayName").value("District 09"));

		ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
		ArgumentCaptor<Map<String, Object>> parameters = ArgumentCaptor.captor();
		verify(namedJdbc).query(sql.capture(), parameters.capture(), ArgumentMatchers.<RowMapper<Candidate>>any());
		assertThat(sql.getValue()).contains("LIMIT :limit");
		assertThat(parameters.getValue()).containsEntry("limit", 10);
		List<Map<String, Object>> plan = namedJdbc.queryForList("EXPLAIN " + sql.getValue(), parameters.getValue());
		assertThat(plan).anySatisfy(row -> assertThat(row.get("table")).isEqualTo("accommodations"));
		log.info("MySQL location suggestion plan (one projection SELECT per eligible request): {}", plan);
	}

	@Test
	void skipsDatabaseForShortQueriesAndRejectsLongRawInput() throws Exception {
		clearInvocations(namedJdbc);
		mockMvc.perform(get(SUGGESTIONS_URL)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		for (String q : List.of("", " \t\u00a0 ", "서", "🗺")) {
			mockMvc.perform(get(SUGGESTIONS_URL).param("q", q))
					.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
		}
		mockMvc.perform(get(SUGGESTIONS_URL).param("q", " ".repeat(101)))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("COMMON_001"))
				.andExpect(jsonPath("$.errors[0].field").value("q"));
		verify(namedJdbc, never()).query(anyString(), anyMap(), ArgumentMatchers.<RowMapper<Candidate>>any());
		mockMvc.perform(get(SUGGESTIONS_URL).param("q", "없는지역"))
				.andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void allowsOnlyTheExactPublicGetAndPreservesAdminWriteSecurity() throws Exception {
		String user = "Bearer " + jwtTokenProvider.createAccessToken(1L, MemberRole.USER);
		mockMvc.perform(get(SUGGESTIONS_URL).header("Authorization", user).param("q", "서울"))
				.andExpect(status().isOk());
		mockMvc.perform(get(SUGGESTIONS_URL + "/extra")).andExpect(status().isUnauthorized());
		mockMvc.perform(post(SUGGESTIONS_URL)).andExpect(status().isUnauthorized());
		mockMvc.perform(post(CATALOG_URL)).andExpect(status().isUnauthorized());
		mockMvc.perform(post(CATALOG_URL).header("Authorization", user)).andExpect(status().isForbidden());
	}

	private MockHttpServletRequestBuilder search(Map<String, String> params) {
		var request = get(CATALOG_URL);
		params.forEach(request::param);
		return request;
	}

	private void insert(String name, String country, String city, String region, String status) {
		jdbc.update("""
				INSERT INTO accommodations (name, description, country, city, region, address, status, time_zone)
				VALUES (?, 'Test accommodation', ?, ?, ?, '서울특별시 강남구 Central 1', ?, 'Asia/Seoul')
				""", name, country, city, region, status);
	}
}
