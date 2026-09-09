package junsik.reservation.dto;

import junsik.reservation.entity.RepresentativeGuest;

public record RepresentativeGuestResponse(String name, String email, String phone) {

	public static RepresentativeGuestResponse from(RepresentativeGuest guest) {
		return guest == null ? null : new RepresentativeGuestResponse(
				guest.getName(),
				guest.getEmail(),
				guest.getPhone()
		);
	}
}
