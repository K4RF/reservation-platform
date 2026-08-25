package junsik.reservation.repository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.jpa.domain.Specification;

import junsik.reservation.entity.Room;
import junsik.reservation.enums.RoomStatus;

public final class RoomSpecifications {

	private RoomSpecifications() {
	}

	public static Specification<Room> withFilters(
			Long accommodationId,
			Integer minCapacity,
			BigDecimal minPrice,
			BigDecimal maxPrice,
			RoomStatus status
	) {
		return (root, query, criteriaBuilder) -> {
			List<Predicate> predicates = new ArrayList<>();
			predicates.add(criteriaBuilder.equal(root.get("accommodation").get("id"), accommodationId));
			if (minCapacity != null) {
				predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("capacity"), minCapacity));
			}
			if (minPrice != null) {
				predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("nightlyPrice"), minPrice));
			}
			if (maxPrice != null) {
				predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("nightlyPrice"), maxPrice));
			}
			if (status != null) {
				predicates.add(criteriaBuilder.equal(root.get("status"), status));
			}
			return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
		};
	}
}
