export function accessTokenWithExpiry(
  expiresAt: number,
  tokenType = 'ACCESS',
  role = 'USER',
): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ token_type: tokenType, exp: expiresAt, role }))
  return `${header}.${payload}.test-signature`
}
