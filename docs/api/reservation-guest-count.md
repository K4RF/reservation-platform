# Reservation Guest Count Policy

## Model decision

Room `capacity` and Reservation `guestCount` represent the total number of
guests. Adults and children are not separated because the current service has
no age-based rate or capacity rule. A later pricing issue may introduce a more
detailed model only when the business rule requires it.

## Reservation creation

`POST /api/v1/reservations` requires `guestCount`.

```json
{
  "roomId": 1,
  "guestCount": 2,
  "checkInDate": "2030-01-10",
  "checkOutDate": "2030-01-15"
}
```

- `guestCount` must be at least 1. Bean Validation returns `COMMON_001` with a
  field error when this input rule is violated.
- `guestCount` must not exceed the selected room's `capacity`. The API returns
  `400 Bad Request` and `RESERVATION_008` when it does.
- The accepted value is stored on the reservation and returned as
  `ReservationResponse.guestCount`.
- Availability search uses the same total-guest interpretation and returns only
  rooms whose capacity is greater than or equal to the requested `guestCount`.

## Schedule changes

`PATCH /api/v1/reservations/{reservationId}` changes dates only. The stored
guest count is immutable in the current API. Before changing the dates, the
service rechecks the stored guest count against the room's current capacity.
This prevents a schedule change after an administrator has reduced the room
capacity below the reservation's guest count.

## Persistence

`reservations.guest_count` is `NOT NULL`, defaults to 1 for legacy-compatible
database writes, and has the named CHECK constraint
`chk_reservations_guest_count (guest_count >= 1)`. New application reservations
always set the value explicitly. Existing local databases use the reviewed
one-time upgrade under `docs/erd/mysql-guest-count-upgrade.sql`.
