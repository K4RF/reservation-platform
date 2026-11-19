import { expect, it, vi } from 'vitest'
import { getBookingPolicy } from './bookingPolicy'
import { bookingPolicy } from '../test/adminAccommodation'
import { setTokenPair } from '../state/accessToken'
import { accessTokenWithExpiry } from '../test/jwt'

const policy = { ...bookingPolicy, accommodationId: 7, bookingPolicyId: 2 }

it('reads a current policy and represents only 204 as unset without sending a token', async () => {
  setTokenPair(
    accessTokenWithExpiry(Math.floor(Date.now() / 1000) + 300, 'ACCESS', 'ADMIN'),
    'fixture',
  )
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json(policy))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  await expect(getBookingPolicy(7)).resolves.toEqual(policy)
  await expect(getBookingPolicy(7)).resolves.toBeNull()
  for (const [url, init] of fetch.mock.calls) {
    expect(url).toBe('/api/v1/accommodations/7/booking-policy')
    expect(init.method).toBe('GET')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  }
})

it.each([
  { ...policy, accommodationId: 8 },
  { ...policy, bookingPolicyId: 0 },
  { ...policy, minStayNights: 0 },
  { ...policy, maxStayNights: 0 },
  { ...policy, minAdvanceBookingDays: -1 },
  { ...policy, minAdvanceBookingDays: 5, maxAdvanceBookingDays: 4 },
  { ...policy, maxAdvanceBookingDays: 1.25 },
  { ...policy, maxAdvanceBookingDays: 2147483648 },
  null,
])('rejects invalid policy %j', async (body) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
  await expect(getBookingPolicy(7)).rejects.toMatchObject({ kind: 'unexpected_response' })
})

it('rejects noncontract success and distinguishes missing accommodation, transport and malformed payload', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 205 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce(new Response('bad json'))
  vi.stubGlobal('fetch', fetch)
  await expect(getBookingPolicy(0)).rejects.toBeInstanceOf(RangeError)
  expect(fetch).not.toHaveBeenCalled()
  await expect(getBookingPolicy(7)).rejects.toMatchObject({ kind: 'unexpected_response' })
  await expect(getBookingPolicy(7)).rejects.toMatchObject({ kind: 'http', status: 404 })
  await expect(getBookingPolicy(7)).rejects.toMatchObject({ kind: 'network' })
  await expect(getBookingPolicy(7)).rejects.toMatchObject({ kind: 'unexpected_response' })
})
