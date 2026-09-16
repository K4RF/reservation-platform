package junsik.reservation.dto.common.response;

import java.util.List;

public record CursorPageResponse<T>(
		List<T> content,
		int size,
		Long nextCursor,
		boolean hasNext
) {

	public CursorPageResponse {
		content = List.copyOf(content);
	}
}
