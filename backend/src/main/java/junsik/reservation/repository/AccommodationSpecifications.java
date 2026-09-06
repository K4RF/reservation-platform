package junsik.reservation.repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

import org.springframework.data.jpa.domain.Specification;

import junsik.reservation.dto.AccommodationSearchRequest;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.ReservationPeriod;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomStatus;

public final class AccommodationSpecifications {

	private AccommodationSpecifications() {
	}

	public static Specification<Accommodation> withFilters(AccommodationSearchRequest request) {
		return (root, query, criteriaBuilder) -> {
			List<Predicate> predicates = new ArrayList<>();
			addContains(predicates, criteriaBuilder, root, "name", request.name());
			addContains(predicates, criteriaBuilder, root, "address", request.region());

			if (request.status() != null) {
				predicates.add(criteriaBuilder.equal(root.get("status"), request.status()));
			}

			boolean hasRoomFilter = request.guestCount() != null
					|| request.minPrice() != null
					|| request.maxPrice() != null
					|| request.available() != null;
			if (hasRoomFilter) {
				Subquery<Long> matchingRoom = query.subquery(Long.class);
				Root<Room> room = matchingRoom.from(Room.class);
				List<Predicate> roomPredicates = new ArrayList<>();
				roomPredicates.add(criteriaBuilder.equal(room.get("accommodation"), root));
				roomPredicates.add(criteriaBuilder.equal(room.get("status"), RoomStatus.ACTIVE));

				if (request.guestCount() != null) {
					roomPredicates.add(criteriaBuilder.greaterThanOrEqualTo(
							room.get("capacity"),
							request.guestCount()
					));
				}
				if (request.minPrice() != null) {
					roomPredicates.add(criteriaBuilder.greaterThanOrEqualTo(
							room.get("nightlyPrice"),
							request.minPrice()
					));
				}
				if (request.maxPrice() != null) {
					roomPredicates.add(criteriaBuilder.lessThanOrEqualTo(
							room.get("nightlyPrice"),
							request.maxPrice()
					));
				}

				if (request.available() != null) {
					Subquery<Long> availableInventoryCount = matchingRoom.subquery(Long.class);
					Root<RoomInventory> inventory = availableInventoryCount.from(RoomInventory.class);
					availableInventoryCount.select(criteriaBuilder.count(inventory));
					availableInventoryCount.where(
							criteriaBuilder.equal(inventory.get("room"), room),
							criteriaBuilder.greaterThanOrEqualTo(
									inventory.get("inventoryDate"),
									request.checkInDate()
							),
							criteriaBuilder.lessThan(
									inventory.get("inventoryDate"),
									request.checkOutDate()
							),
							criteriaBuilder.greaterThan(
									inventory.get("totalQuantity"),
									inventory.get("reservedQuantity")
							)
					);
					long stayNights = new ReservationPeriod(
							request.checkInDate(),
							request.checkOutDate()
					).stayNights();
					roomPredicates.add(criteriaBuilder.equal(availableInventoryCount, stayNights));
				}

				matchingRoom.select(room.get("id"));
				matchingRoom.where(roomPredicates.toArray(Predicate[]::new));
				Predicate hasMatchingRoom = criteriaBuilder.exists(matchingRoom);
				if (Boolean.FALSE.equals(request.available())) {
					predicates.add(criteriaBuilder.or(
							criteriaBuilder.notEqual(root.get("status"), AccommodationStatus.ACTIVE),
							criteriaBuilder.not(hasMatchingRoom)
					));
				} else {
					if (Boolean.TRUE.equals(request.available())) {
						predicates.add(criteriaBuilder.equal(root.get("status"), AccommodationStatus.ACTIVE));
					}
					predicates.add(hasMatchingRoom);
				}
			}

			return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static void addContains(
			List<Predicate> predicates,
			CriteriaBuilder criteriaBuilder,
			Root<Accommodation> root,
			String property,
			String value
	) {
		if (value == null || value.isBlank()) {
			return;
		}
		String keyword = escapeLike(value.trim().toLowerCase(Locale.ROOT));
		predicates.add(criteriaBuilder.like(
				criteriaBuilder.lower(root.get(property)),
				"%" + keyword + "%",
				'\\'
		));
	}

	private static String escapeLike(String value) {
		return value
				.replace("\\", "\\\\")
				.replace("%", "\\%")
				.replace("_", "\\_");
	}
}
