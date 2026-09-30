export function accessTokenWithExpiry(expiresAt: number, tokenType = 'ACCESS'): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ token_type: tokenType, exp: expiresAt }))
  return `${header}.${payload}.test-signature`
}
