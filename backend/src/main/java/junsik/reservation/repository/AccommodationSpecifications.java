package junsik.reservation.repository;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;

import org.springframework.data.jpa.domain.Specification;

import junsik.reservation.dto.AccommodationSearchRequest;
import junsik.reservation.entity.Accommodation;
import junsik.reservation.entity.AccommodationBookingPolicy;
import junsik.reservation.entity.ReservationPeriod;
import junsik.reservation.entity.Room;
import junsik.reservation.entity.RoomInventory;
import junsik.reservation.enums.AccommodationAmenity;
import junsik.reservation.enums.AccommodationStatus;
import junsik.reservation.enums.RoomAmenity;
import junsik.reservation.enums.RoomInventorySaleStatus;
import junsik.reservation.enums.RoomStatus;

public final class AccommodationSpecifications {

	private AccommodationSpecifications() {
	}

	public static Specification<Accommodation> withFilters(
			AccommodationSearchRequest request,
			LocalDate today
	) {
		return (root, query, criteriaBuilder) -> {
			List<Predicate> predicates = new ArrayList<>();
			addContains(predicates, criteriaBuilder, root, "name", request.name());
			addLocationFilters(predicates, criteriaBuilder, root, request);
			for (AccommodationAmenity amenity : request.accommodationAmenities()) {
				predicates.add(criteriaBuilder.isMember(
						amenity,
						root.<Collection<AccommodationAmenity>>get("amenities")
				));
			}

			if (request.status() != null) {
				predicates.add(criteriaBuilder.equal(root.get("status"), request.status()));
			}

			boolean hasRoomFilter = request.guestCount() != null
					|| request.minPrice() != null
					|| request.maxPrice() != null
					|| request.available() != null
					|| !request.roomAmenities().isEmpty();
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
				for (RoomAmenity amenity : request.roomAmenities()) {
					roomPredicates.add(criteriaBuilder.isMember(
							amenity,
							room.<Collection<RoomAmenity>>get("amenities")
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
							criteriaBuilder.equal(
									inventory.get("saleStatus"),
									RoomInventorySaleStatus.OPEN
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
				Predicate policyAllowsPeriod = bookingPolicyAllows(
						root,
						query.subquery(Long.class),
						criteriaBuilder,
						request,
						today
				);
				Predicate isAvailable = criteriaBuilder.and(
						criteriaBuilder.equal(root.get("status"), AccommodationStatus.ACTIVE),
						hasMatchingRoom,
						policyAllowsPeriod
				);
				if (Boolean.FALSE.equals(request.available())) {
					predicates.add(criteriaBuilder.not(isAvailable));
				} else {
					predicates.add(Boolean.TRUE.equals(request.available()) ? isAvailable : hasMatchingRoom);
				}
			}

			return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static void addLocationFilters(
			List<Predicate> predicates,
			CriteriaBuilder criteriaBuilder,
			Root<Accommodation> root,
			AccommodationSearchRequest request
	) {
		Expression<String> city = root.get("location").get("city");
		if (request.city() != null && !request.city().isBlank()) {
			predicates.add(criteriaBuilder.equal(
					city,
					request.city().trim()
			));
		}
		if (request.region() == null || request.region().isBlank()) {
			return;
		}
		String regionKeyword = request.region().trim().toLowerCase(Locale.ROOT);
		Expression<String> region = root.get("location").get("region");
		Expression<String> detailAddress = root.get("location").get("detailAddress");
		predicates.add(criteriaBuilder.or(
				criteriaBuilder.equal(region, request.region().trim()),
				criteriaBuilder.and(
						criteriaBuilder.isNull(region),
						criteriaBuilder.like(
								criteriaBuilder.lower(detailAddress),
								"%" + escapeLike(regionKeyword) + "%",
								'\\'
						)
				)
		));
	}

	private static Predicate bookingPolicyAllows(
			Root<Accommodation> accommodation,
			Subquery<Long> incompatiblePolicy,
			CriteriaBuilder criteriaBuilder,
			AccommodationSearchRequest request,
			LocalDate today
	) {
		if (request.checkInDate() == null) {
			return criteriaBuilder.conjunction();
		}

		long stayNights = ChronoUnit.DAYS.between(request.checkInDate(), request.checkOutDate());
		long advanceBookingDays = ChronoUnit.DAYS.between(today, request.checkInDate());
		Root<AccommodationBookingPolicy> policy = incompatiblePolicy.from(AccommodationBookingPolicy.class);
		incompatiblePolicy.select(policy.get("id"));
		incompatiblePolicy.where(
				criteriaBuilder.equal(policy.get("accommodation"), accommodation),
				criteriaBuilder.or(
						criteriaBuilder.greaterThan(policy.get("minStayNights"), stayNights),
						criteriaBuilder.lessThan(policy.get("maxStayNights"), stayNights),
						criteriaBuilder.greaterThan(policy.get("minAdvanceBookingDays"), advanceBookingDays),
						criteriaBuilder.lessThan(policy.get("maxAdvanceBookingDays"), advanceBookingDays)
				)
		);
		return criteriaBuilder.not(criteriaBuilder.exists(incompatiblePolicy));
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
