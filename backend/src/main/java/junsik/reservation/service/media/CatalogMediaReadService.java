package junsik.reservation.service.media;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import junsik.reservation.dto.media.response.MediaResponse;
import junsik.reservation.repository.CatalogMediaRepository;

@Service
@Transactional(readOnly = true)
public class CatalogMediaReadService {

	public static final int GALLERY_LIMIT = 20;
	private final CatalogMediaRepository repository;

	public CatalogMediaReadService(CatalogMediaRepository repository) { this.repository = repository; }

	public Map<Long, List<MediaResponse>> accommodationImages(List<Long> ids, int limit) {
		validateLimit(limit);
		if (ids.isEmpty()) { return Map.of(); }
		return repository.findAccommodationImages(ids, limit).stream().collect(Collectors.groupingBy(
				media -> media.getAccommodation().getId(),
				Collectors.mapping(MediaResponse::from, Collectors.toList())));
	}

	public Map<Long, List<MediaResponse>> roomImages(List<Long> ids, int limit) {
		validateLimit(limit);
		if (ids.isEmpty()) { return Map.of(); }
		return repository.findRoomImages(ids, limit).stream().collect(Collectors.groupingBy(
				media -> media.getRoom().getId(),
				Collectors.mapping(MediaResponse::from, Collectors.toList())));
	}

	private static void validateLimit(int limit) {
		if (limit < 1 || limit > GALLERY_LIMIT) { throw new IllegalArgumentException("Invalid media read limit"); }
	}
}
