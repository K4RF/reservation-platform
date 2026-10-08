// Mirrors Backend CreateReservationRequest; ownership and final prices are server-owned.
export interface RepresentativeGuestRequest {
  name: string
  email: string
  phone: string
}

export interface BookingRequest {
  roomId: number
  guestCount: number
  checkInDate: string
  checkOutDate: string
  representativeGuest: RepresentativeGuestRequest
}
