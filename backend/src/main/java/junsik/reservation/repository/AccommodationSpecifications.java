package junsik.reservation.repository;

import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

import junsik.reservation.entity.Accommodation;

public final class AccommodationSpecifications {

	private AccommodationSpecifications() {
	}

	public static Specification<Accommodation> nameContains(String name) {
		return (root, query, criteriaBuilder) -> {
			if (name == null || name.isBlank()) {
				return criteriaBuilder.conjunction();
			}
			String keyword = name.trim()
					.toLowerCase(Locale.ROOT)
					.replace("\\", "\\\\")
					.replace("%", "\\%")
					.replace("_", "\\_");
			return criteriaBuilder.like(
					criteriaBuilder.lower(root.get("name")),
					"%" + keyword + "%",
					'\\'
			);
		};
	}
}
