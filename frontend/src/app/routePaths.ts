export const routePaths = {
  home: '/',
  login: '/login',
  oauth2Callback: '/oauth2/callback',
  signup: '/signup',
  accommodations: '/accommodations',
  reservations: '/reservations',
  admin: '/admin',
} as const

// Numeric server ID, never the public reservation number or guest data, identifies this route.
export function bookingCompletePath(reservationId: number): string {
  if (!Number.isSafeInteger(reservationId) || reservationId < 1)
    throw new RangeError('Invalid reservation ID')
  return `${routePaths.reservations}/${reservationId}/complete`
}
