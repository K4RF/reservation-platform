package junsik.reservation.repository;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.jpa.domain.Specification;

import junsik.reservation.entity.Reservation;
import junsik.reservation.enums.ReservationStatus;

public final class ReservationSpecifications {

	private ReservationSpecifications() {
	}

	public static Specification<Reservation> withFilters(
			Long memberId,
			ReservationStatus status,
			LocalDate checkInFrom,
			LocalDate checkInTo,
			LocalDate checkOutFrom,
			LocalDate checkOutTo
	) {
		return (root, query, criteriaBuilder) -> {
			List<Predicate> predicates = new ArrayList<>();
			predicates.add(criteriaBuilder.equal(root.get("member").get("id"), memberId));
			if (status != null) {
				predicates.add(criteriaBuilder.equal(root.get("status"), status));
			}
			if (checkInFrom != null) {
				predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("checkInDate"), checkInFrom));
			}
			if (checkInTo != null) {
				predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("checkInDate"), checkInTo));
			}
			if (checkOutFrom != null) {
				predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("checkOutDate"), checkOutFrom));
			}
			if (checkOutTo != null) {
				predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("checkOutDate"), checkOutTo));
			}
			return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
		};
	}
}
