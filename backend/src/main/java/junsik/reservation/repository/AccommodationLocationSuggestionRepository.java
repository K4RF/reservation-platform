package junsik.reservation.repository;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import junsik.reservation.enums.AccommodationLocationSuggestionType;

@Repository
public class AccommodationLocationSuggestionRepository {

	private static final int MAX_RESULTS = 10;
	// Rank and cap only distinct matching locations. The earliest active ID supplies the stored spelling.
	private static final String SEARCH_SQL = """
			WITH active_locations AS (
			    SELECT id, country, city, region
			    FROM accommodations
			    WHERE status = 'ACTIVE' AND TRIM(country) <> '' AND TRIM(city) <> ''
			), location_candidates AS (
			    SELECT id, country, city, NULL AS region, 'CITY' AS candidate_type,
			           ROW_NUMBER() OVER (PARTITION BY country, city ORDER BY id) AS duplicate_order
			    FROM active_locations
			    WHERE %s
			    UNION ALL
			    SELECT id, country, city, region, 'REGION' AS candidate_type,
			           ROW_NUMBER() OVER (PARTITION BY country, city, region ORDER BY id) AS duplicate_order
			    FROM active_locations
			    WHERE TRIM(region) <> '' AND %s
			), candidate_labels AS (
			    SELECT id, country, city, region, candidate_type,
			           LOWER(COALESCE(region, city)) AS primary_label,
			           LOWER(CASE WHEN region IS NULL THEN city ELSE CONCAT(city, ' ', region) END) AS full_label
			    FROM location_candidates
			    WHERE duplicate_order = 1
			)
			SELECT country, city, region, candidate_type
			FROM candidate_labels
			ORDER BY CASE
			    WHEN primary_label = :exact OR full_label = :exact THEN 0
			    WHEN primary_label LIKE :prefix ESCAPE '!' OR full_label LIKE :prefix ESCAPE '!' THEN 1
			    WHEN primary_label LIKE :contains ESCAPE '!' OR full_label LIKE :contains ESCAPE '!' THEN 2
			    ELSE 3 END,
			    candidate_type, country, city, region, id
			LIMIT :limit
			""";

	private final NamedParameterJdbcTemplate jdbc;

	public AccommodationLocationSuggestionRepository(NamedParameterJdbcTemplate jdbc) {
		this.jdbc = jdbc;
	}

	public List<Candidate> findSuggestions(String normalizedQuery) {
		Map<String, Object> parameters = new HashMap<>();
		parameters.put("exact", normalizedQuery);
		String escapedQuery = escapeLike(normalizedQuery);
		parameters.put("prefix", escapedQuery + "%");
		parameters.put("contains", "%" + escapedQuery + "%");
		parameters.put("limit", MAX_RESULTS);

		List<String> tokens = Arrays.stream(normalizedQuery.split(" ")).distinct().toList();
		StringJoiner cityMatches = new StringJoiner(" AND ");
		StringJoiner regionMatches = new StringJoiner(" AND ");
		for (int index = 0; index < tokens.size(); index++) {
			String parameter = "term" + index;
			parameters.put(parameter, "%" + escapeLike(tokens.get(index)) + "%");
			String cityMatch = "LOWER(city) LIKE :" + parameter + " ESCAPE '!'";
			cityMatches.add(cityMatch);
			regionMatches.add("(" + cityMatch + " OR LOWER(region) LIKE :" + parameter + " ESCAPE '!')");
		}

		return jdbc.query(SEARCH_SQL.formatted(cityMatches, regionMatches), parameters, (rs, rowNum) -> new Candidate(
				AccommodationLocationSuggestionType.valueOf(rs.getString("candidate_type")),
				rs.getString("country"), rs.getString("city"), rs.getString("region")
		));
	}

	private static String escapeLike(String text) {
		return text.replace("!", "!!").replace("%", "!%").replace("_", "!_");
	}

	public record Candidate(AccommodationLocationSuggestionType type, String country, String city, String region) {
	}
}
