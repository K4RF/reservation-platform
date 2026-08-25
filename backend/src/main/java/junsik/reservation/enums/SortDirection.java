package junsik.reservation.enums;

import org.springframework.data.domain.Sort;

public enum SortDirection {

	ASC,
	DESC;

	public Sort.Direction toSpringDirection() {
		return Sort.Direction.valueOf(name());
	}
}
