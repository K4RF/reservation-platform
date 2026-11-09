package junsik.reservation.service.accommodation;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import junsik.reservation.dto.accommodation.response.AccommodationLocationSuggestionResponse;
import junsik.reservation.dto.accommodation.response.AccommodationLocationSuggestionResponse.SearchParams;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.repository.AccommodationLocationSuggestionRepository;

@Service
public class AccommodationLocationSuggestionService {

	private static final Pattern WHITESPACE = Pattern.compile("\\s+", Pattern.UNICODE_CHARACTER_CLASS);
	private static final int MIN_QUERY_LENGTH = 2;
	private final AccommodationLocationSuggestionRepository repository;

	public AccommodationLocationSuggestionService(AccommodationLocationSuggestionRepository repository) {
		this.repository = repository;
	}

	public List<AccommodationLocationSuggestionResponse> suggest(String query) {
		if (query == null) {
			return List.of();
		}
		String normalized = WHITESPACE.matcher(query).replaceAll(" ").strip();
		if (normalized.codePointCount(0, normalized.length()) < MIN_QUERY_LENGTH) {
			return List.of();
		}
		return repository.findSuggestions(normalized.toLowerCase(Locale.ROOT)).stream()
				.map(candidate -> new AccommodationLocationSuggestionResponse(
						candidate.type(),
						candidate.region() == null ? candidate.city() : candidate.region(),
						new SearchParams(candidate.country(), candidate.city(), candidate.region(), AccommodationStatus.ACTIVE)
				))
				.toList();
	}
}
