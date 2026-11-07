import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

function check(value, label) {
  if (!value) throw new Error(`Auth contract failed: ${label}`)
}

async function expectError(action, status, code) {
  try {
    await action()
  } catch (error) {
    check(error?.status === status && error?.code === code, `HTTP ${status} ${code}`)
    return error
  }
  throw new Error(`Expected HTTP ${status} ${code}`)
}

// Keep the real claims (including exp) for client hints, but make the server reject the signature.
function invalidSignature(token) {
  const [header, payload, signature] = token.split('.')
  check(header && payload && signature, 'JWT structure')
  return [header, payload, (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)].join('.')
}

// Launched by the isolated runner only. Responses are never substituted.
export async function verifyAuth({ webOrigin, fixtures, seedLoginCode }) {
  check(webOrigin === 'http://127.0.0.1:15199', 'isolated proxy origin')
  const vite = await createServer({
    configFile: false,
    envDir: false,
    envPrefix: 'INTEGRATION_AUTH_INTERNAL_',
    root: fileURLToPath(new URL('../', import.meta.url)),
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true, ws: false, watch: null },
  })
  const nativeFetch = globalThis.fetch
  const trace = []
  try {
    const { apiClient } = await vite.ssrLoadModule('/src/api/client.ts')
    const { loginWithEmail, logoutFromBackend, exchangeGoogleLoginCode } =
      await vite.ssrLoadModule('/src/api/auth.ts')
    const { signUpMember } = await vite.ssrLoadModule('/src/api/member.ts')
    const { getReservationDetail } = await vite.ssrLoadModule('/src/api/reservationDetail.ts')
    const { changeReservationSchedule } = await vite.ssrLoadModule('/src/api/reservationChange.ts')
    const session = await vite.ssrLoadModule('/src/state/accessToken.ts')
    globalThis.fetch = async (input, init) => {
      const url = new URL(input, webOrigin)
      check(url.origin === webOrigin && url.pathname.startsWith('/api/v1/'), 'fetch stays isolated')
      const response = await nativeFetch(url, { ...init, redirect: 'error' })
      trace.push({ method: init?.method ?? 'GET', path: url.pathname, status: response.status })
      return response
    }

    const install = ({ accessToken, refreshToken }, rejected = false) =>
      session.setTokenPair(rejected ? invalidSignature(accessToken) : accessToken, refreshToken)
    const reservation = `/reservations/${fixtures.reservationId}`
    const inventory = `/rooms/${fixtures.roomId}/inventories`
    const [ownerAccount, otherAccount, adminAccount] = fixtures.accounts
    const newAccount = {
      email: 'auth-contract@example.test',
      password: randomBytes(24).toString('hex'),
    }
    const count = (method, path, status) =>
      trace.filter(
        (entry) =>
          entry.method === method &&
          entry.path === '/api/v1' + path &&
          (status === undefined || entry.status === status),
      ).length
    const explicitAccess = (token) => ({
      includeAuth: false,
      retryOnUnauthorized: false,
      headers: { Authorization: 'Bearer ' + token },
    })
    const reissueBody = (refreshToken) => ({
      method: 'POST',
      includeAuth: false,
      body: { refreshToken },
    })

    const invalid = await expectError(
      () => signUpMember({ email: 'invalid', password: 'short' }),
      400,
      'COMMON_001',
    )
    check(
      invalid.fieldErrors.some(({ field }) => field === 'email'),
      'field-level email error',
    )
    const member = await signUpMember(newAccount)
    check(member.role === 'USER' && Number.isSafeInteger(member.memberId), 'signup response')
    await expectError(() => signUpMember(newAccount), 409, 'MEMBER_001')
    await expectError(
      () => loginWithEmail({ ...newAccount, password: randomBytes(20).toString('hex') }),
      401,
      'AUTH_003',
    )
    const newLogin = await loginWithEmail(newAccount)
    install(newLogin)
    check(session.getRoleHint() === 'USER', 'client role hint on email login')
    session.clearAccessToken()
    await expectError(() => apiClient.request(reservation), 401, 'AUTH_001')
    install(await loginWithEmail(otherAccount))
    await expectError(() => apiClient.request(reservation), 403, 'RESERVATION_004')
    install(await loginWithEmail(adminAccount))
    check(session.getRoleHint() === 'ADMIN', 'admin role hint')
    await expectError(() => apiClient.request(reservation), 403, 'RESERVATION_004')
    install(await loginWithEmail(ownerAccount))
    const saved = await getReservationDetail(fixtures.reservationId)
    check(saved.reservationId === fixtures.reservationId, 'owner reads saved reservation')
    const calendar = `${inventory}?startDate=${saved.checkInDate}&endDate=${saved.checkOutDate}`
    await expectError(() => apiClient.request(calendar), 403, 'AUTH_002')
    install(await loginWithEmail(adminAccount))
    check((await apiClient.request(calendar)).roomId === fixtures.roomId, 'ADMIN inventory read')
    console.log('PASS signup 201/400/409, email login 200/401 and owner/foreign/ADMIN permissions')

    const beforeExpiry = await loginWithEmail(ownerAccount)
    const expiresAt = install(beforeExpiry)
    const remaining = expiresAt - Date.now()
    check(remaining > 0 && remaining <= 12_000, 'short isolated Access TTL')
    await delay(remaining + 50)
    trace.length = 0
    await getReservationDetail(fixtures.reservationId)
    check(
      count('POST', '/auth/reissue', 200) === 1 &&
        count('GET', reservation) === 1 &&
        count('GET', reservation, 200) === 1,
      'expired client token reissues before one GET',
    )
    console.log('PASS short Access expiry: POST reissue 200 → GET 200')

    install(await loginWithEmail(ownerAccount), true)
    trace.length = 0
    await Promise.all([
      getReservationDetail(fixtures.reservationId),
      apiClient.request('/reservations'),
    ])
    check(
      count('GET', reservation, 401) === 1 &&
        count('GET', '/reservations', 401) === 1 &&
        count('POST', '/auth/reissue') === 1 &&
        count('POST', '/auth/reissue', 200) === 1 &&
        count('GET', reservation, 200) === 1 &&
        count('GET', '/reservations', 200) === 1 &&
        trace.length === 5,
      'concurrent rejected reads share one refresh and retry once each',
    )
    console.log('PASS concurrent HTTP: GET 401 ×2 → POST reissue 200 ×1 → GET 200 ×2')

    const writeLogin = await loginWithEmail(ownerAccount)
    install(writeLogin, true)
    trace.length = 0
    await expectError(
      () =>
        changeReservationSchedule(saved, {
          checkInDate: saved.checkInDate,
          checkOutDate: saved.checkOutDate,
        }),
      401,
      'AUTH_001',
    )
    check(
      trace.length === 1 &&
        count('PATCH', reservation, 401) === 1 &&
        session.isLoginRequired() &&
        !session.getRefreshToken(),
      'write is not replayed',
    )
    const reread = await apiClient.request(reservation, explicitAccess(writeLogin.accessToken))
    check(
      reread.status === saved.status &&
        reread.checkInDate === saved.checkInDate &&
        reread.checkOutDate === saved.checkOutDate,
      'rejected write left saved data unchanged',
    )
    console.log('PASS PATCH 401 ×1; no refresh/replay and saved dates unchanged')

    const logout = await loginWithEmail(ownerAccount)
    install(logout)
    await logoutFromBackend()
    // AuthProvider clears in-memory state after this API completes (covered by Browser and RTL).
    session.clearAccessToken()
    await expectError(
      () => apiClient.request('/auth/reissue', reissueBody(logout.refreshToken)),
      401,
      'AUTH_006',
    )
    check(!session.getStoredAccessToken() && !session.getRefreshToken(), 'local session cleared')
    check(
      (await apiClient.request(reservation, explicitAccess(logout.accessToken))).reservationId ===
        fixtures.reservationId,
      'logout does not blacklist a still-valid Access Token',
    )

    const revoked = await loginWithEmail(ownerAccount)
    install(revoked, true)
    await apiClient.request('/auth/logout', {
      method: 'POST',
      ...explicitAccess(revoked.accessToken),
    })
    trace.length = 0
    await expectError(() => getReservationDetail(fixtures.reservationId), 401, 'AUTH_006')
    check(
      trace.length === 2 &&
        count('GET', reservation, 401) === 1 &&
        count('POST', '/auth/reissue', 401) === 1 &&
        session.isLoginRequired() &&
        !session.getStoredAccessToken() &&
        !session.getRefreshToken(),
      'failed reissue clears session without retry',
    )
    console.log(
      'PASS logout Redis revocation, prior Access still valid, rejected reissue requires login',
    )

    const expiredCode = randomBytes(32).toString('base64url')
    seedLoginCode(expiredCode, member.memberId, 250)
    await delay(400)
    await expectError(() => exchangeGoogleLoginCode(expiredCode), 401, 'AUTH_007')
    const liveCode = randomBytes(32).toString('base64url')
    seedLoginCode(liveCode, member.memberId, 30_000)
    install(await exchangeGoogleLoginCode(liveCode))
    check(
      session.getRoleHint() === 'USER' &&
        (await apiClient.request('/reservations')).totalElements === 0,
      'one-time exchange establishes usable application session',
    )
    await expectError(() => exchangeGoogleLoginCode(liveCode), 401, 'AUTH_007')
    console.log(
      'PASS Redis fixture exchange 200, expired/replayed code 401; external Provider not contacted',
    )
  } finally {
    globalThis.fetch = nativeFetch
    await vite.close()
  }
}
